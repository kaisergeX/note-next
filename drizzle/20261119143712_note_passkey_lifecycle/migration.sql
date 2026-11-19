ALTER TABLE "note_passkeys" ADD COLUMN "provisional_expires_at" timestamp with time zone;--> statement-breakpoint
-- Previously verified rows may have been installed by an earlier release.
UPDATE "note_passkeys" AS credential
SET "provisional_expires_at" = now() + interval '24 hours'
WHERE credential."verified_at" IS NULL AND NOT EXISTS (
	SELECT 1 FROM "note_vaults" AS vault
	WHERE vault."owner_id" = credential."owner_id"
		AND vault."id" = credential."vault_id"
		AND vault."primary_wrapper"->'passkeyBinding'->>0 = credential."rp_id"
		AND vault."primary_wrapper"->'passkeyBinding'->>1 = credential."credential_id"
);--> statement-breakpoint
CREATE INDEX "note_passkey_challenges_owner_kind_idx" ON "note_passkey_challenges" ("owner_id","kind");--> statement-breakpoint
CREATE INDEX "note_passkeys_owner_expiry_idx" ON "note_passkeys" ("owner_id","provisional_expires_at");
