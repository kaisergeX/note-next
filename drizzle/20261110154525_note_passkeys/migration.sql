CREATE TABLE "note_passkey_challenges" (
	"id" uuid PRIMARY KEY,
	"owner_id" uuid NOT NULL,
	"vault_id" uuid NOT NULL,
	"credential_id" text,
	"kind" text NOT NULL,
	"challenge" text NOT NULL,
	"origin" text NOT NULL,
	"rp_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_passkeys" (
	"credential_id" text PRIMARY KEY,
	"owner_id" uuid NOT NULL,
	"vault_id" uuid NOT NULL,
	"rp_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" bigint NOT NULL,
	"transports" jsonb NOT NULL,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "note_passkey_challenges" ADD CONSTRAINT "note_passkey_challenges_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "note_passkeys" ADD CONSTRAINT "note_passkeys_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;