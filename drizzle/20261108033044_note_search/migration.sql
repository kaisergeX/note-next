CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TABLE "note_search_documents" (
	"note_id" uuid PRIMARY KEY,
	"title_text" text NOT NULL,
	"body_text" text,
	"title_fold" text NOT NULL,
	"body_fold" text
);
--> statement-breakpoint
CREATE INDEX "note_search_title_trgm_idx" ON "note_search_documents" USING gin ("title_fold" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "note_search_body_trgm_idx" ON "note_search_documents" USING gin ("body_fold" gin_trgm_ops);--> statement-breakpoint
ALTER TABLE "note_search_documents" ADD CONSTRAINT "note_search_documents_note_id_notes_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE;
--> statement-breakpoint
-- Keep title search on a direct encryption transition, while removing every
-- derived body byte. Other direct source edits require canonical re-projection.
CREATE FUNCTION invalidate_note_search_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.title IS DISTINCT FROM OLD.title THEN
    DELETE FROM note_search_documents WHERE note_id = NEW.id;
  ELSIF NEW.is_encrypted THEN
    UPDATE note_search_documents SET body_text = NULL, body_fold = NULL WHERE note_id = NEW.id;
  ELSIF NEW.content IS DISTINCT FROM OLD.content OR NEW.is_encrypted IS DISTINCT FROM OLD.is_encrypted THEN
    DELETE FROM note_search_documents WHERE note_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER invalidate_note_search_document AFTER UPDATE OF title, content, is_encrypted ON notes
FOR EACH ROW EXECUTE FUNCTION invalidate_note_search_document();
--> statement-breakpoint
-- Enforce the privacy boundary even for callers outside the note repository.
CREATE FUNCTION protect_note_search_body() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT is_encrypted FROM notes WHERE id = NEW.note_id FOR SHARE) THEN
    NEW.body_text := NULL;
    NEW.body_fold := NULL;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER protect_note_search_body BEFORE INSERT OR UPDATE ON note_search_documents
FOR EACH ROW EXECUTE FUNCTION protect_note_search_body();
--> statement-breakpoint
-- JavaScript's Unicode lowercase expands U+0130 into two code points. Map
-- folded match offsets back to NFC source with a binary search, not a full
-- document response or a quadratic prefix walk. Snippets are plain text.
CREATE FUNCTION note_search_excerpt(source text, folded text, query text, budget integer)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  hit integer := strpos(folded, query);
  lo integer := 0;
  hi integer := char_length(source);
  middle integer;
  start_at integer;
  excerpt text;
BEGIN
  IF source IS NULL THEN RETURN ''; END IF;
  -- Detoast once; repeated prefix reads must not decompress long notes again.
  source := source || '';
  IF hit > 0 THEN
    IF strpos(source, chr(304)) = 0 THEN
      lo := hit - 1;
    ELSE
      WHILE lo < hi LOOP
        middle := (lo + hi + 1) / 2;
        IF char_length(normalize(replace(left(source, middle), chr(304), 'i' || chr(775)), NFC)) < hit THEN
          lo := middle;
        ELSE
          hi := middle - 1;
        END IF;
      END LOOP;
    END IF;
  END IF;
  start_at := greatest(1, lo + 1 - budget / 3);
  excerpt := substring(source FROM start_at FOR budget);
  RETURN (CASE WHEN start_at > 1 THEN '…' ELSE '' END) || excerpt ||
    (CASE WHEN char_length(source) >= start_at + budget THEN '…' ELSE '' END);
END;
$$;
