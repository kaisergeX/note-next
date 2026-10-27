CREATE TABLE "note_creation_keys" (
	"id" uuid PRIMARY KEY,
	"author_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "revision" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "last_mutation_id" uuid;--> statement-breakpoint
ALTER TABLE "note_creation_keys" ADD CONSTRAINT "note_creation_keys_author_id_users_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE FUNCTION advance_note_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.revision := gen_random_uuid();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER advance_note_revision BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION advance_note_revision();
