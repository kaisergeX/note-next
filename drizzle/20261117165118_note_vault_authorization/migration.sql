CREATE TABLE "note_vault_operation_receipts" (
	"vault_id" uuid,
	"owner_id" uuid NOT NULL,
	"operation_id" uuid,
	"intent_digest" text NOT NULL,
	"applied_revision" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_vault_operation_receipts_pkey" PRIMARY KEY("vault_id","operation_id")
);
--> statement-breakpoint
ALTER TABLE "note_vaults" ADD COLUMN "authorization_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "note_vaults" ADD COLUMN "authorization" jsonb;--> statement-breakpoint
ALTER TABLE "note_vault_operation_receipts" ADD CONSTRAINT "note_vault_operation_receipts_vault_owner_fk" FOREIGN KEY ("vault_id","owner_id") REFERENCES "note_vaults"("id","owner_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "note_vaults" ADD CONSTRAINT "note_vaults_authorization_check" CHECK (("authorization_version" = 0 AND "authorization" IS NULL) OR ("authorization_version" = 1 AND "authorization" IS NOT NULL AND jsonb_typeof("authorization") = 'object' AND coalesce("authorization"->>'version' = '1', false)));
--> statement-breakpoint
-- Legacy rows remain legacy. Bootstrap, verifier rotation and repair need a
-- separately reviewed migration; ordinary writes cannot change pinned state.
CREATE FUNCTION protect_note_vault_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
    OR NEW.setup_id IS DISTINCT FROM OLD.setup_id
    OR NEW.format_version IS DISTINCT FROM OLD.format_version
    OR NEW.authorization_version IS DISTINCT FROM OLD.authorization_version
    OR NEW.authorization IS DISTINCT FROM OLD.authorization
    OR NEW.recovery_wrapper IS DISTINCT FROM OLD.recovery_wrapper THEN
    RAISE EXCEPTION 'Pinned vault authorization and recovery state is immutable';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER protect_note_vault_authorization BEFORE UPDATE ON note_vaults
FOR EACH ROW EXECUTE FUNCTION protect_note_vault_authorization();
