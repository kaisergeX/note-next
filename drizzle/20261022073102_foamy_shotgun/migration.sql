CREATE TABLE "user_appearance" (
	"user_id" uuid PRIMARY KEY,
	"appearance" text NOT NULL,
	"mode" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_appearance_preset_check" CHECK ("appearance" in ('paper-ink', 'sepia', 'midnight', 'bookish')),
	CONSTRAINT "user_appearance_mode_check" CHECK ("mode" in ('system', 'light', 'dark'))
);
--> statement-breakpoint
ALTER TABLE "user_appearance" ADD CONSTRAINT "user_appearance_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;