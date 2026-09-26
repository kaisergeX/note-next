CREATE TABLE "feature_access" (
	"user_id" uuid,
	"feature" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_access_pkey" PRIMARY KEY("user_id","feature")
);
--> statement-breakpoint
ALTER TABLE "feature_access" ADD CONSTRAINT "feature_access_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");