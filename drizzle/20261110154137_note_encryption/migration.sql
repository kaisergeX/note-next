-- Refuse activation over legacy flag-only rows. Audit/quarantine these with the
-- owner before retrying; never invent keys, discard plaintext, or claim E2EE.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM notes WHERE is_encrypted) THEN
    RAISE EXCEPTION 'Legacy is_encrypted notes require an owner-reviewed quarantine before the encryption migration';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE "note_vaults" (
	"id" uuid PRIMARY KEY,
	"owner_id" uuid NOT NULL UNIQUE,
	"setup_id" uuid NOT NULL,
	"revision" uuid DEFAULT gen_random_uuid() NOT NULL,
	"last_operation_id" uuid NOT NULL,
	"format_version" integer DEFAULT 1 NOT NULL,
	"primary_wrapper" jsonb NOT NULL,
	"recovery_wrapper" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_vaults_id_owner_unique" UNIQUE("id","owner_id"),
	CONSTRAINT "note_vaults_format_check" CHECK ("format_version" = 1)
);
--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "vault_id" uuid;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "encrypted_payload" jsonb;--> statement-breakpoint
ALTER TABLE "note_vaults" ADD CONSTRAINT "note_vaults_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_vault_owner_fk" FOREIGN KEY ("vault_id","author_id") REFERENCES "note_vaults"("id","owner_id");--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_encryption_mode_check" CHECK ((NOT "is_encrypted" AND "vault_id" IS NULL AND "encrypted_payload" IS NULL) OR ("is_encrypted" AND "vault_id" IS NOT NULL AND "encrypted_payload" IS NOT NULL AND "title" IS NULL AND "content" IS NULL AND jsonb_typeof("encrypted_payload") = 'object' AND coalesce("encrypted_payload"->>'version' = '1', false)));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION invalidate_note_search_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_encrypted OR NEW.title IS DISTINCT FROM OLD.title OR NEW.content IS DISTINCT FROM OLD.content OR NEW.is_encrypted IS DISTINCT FROM OLD.is_encrypted THEN
    DELETE FROM note_search_documents WHERE note_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_note_search_body() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT is_encrypted FROM notes WHERE id = NEW.note_id FOR SHARE) THEN
    NEW.title_text := '';
    NEW.title_fold := '';
    NEW.body_text := NULL;
    NEW.body_fold := NULL;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DELETE FROM note_search_documents WHERE note_id IN (SELECT id FROM notes WHERE is_encrypted);
