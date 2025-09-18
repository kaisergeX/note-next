CREATE TYPE "public"."theme" AS ENUM('encrypted', 'slate', 'zinc', 'stone', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink', 'rose');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('archivist', 'note-taker');--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT generate_ulid() NOT NULL,
	"author_id" uuid NOT NULL,
	"title" varchar(765),
	"content" text,
	"theme" "theme",
	"is_encrypted" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"pending_deleted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT generate_ulid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(100) NOT NULL,
	"image" text,
	"role" "role" DEFAULT 'note-taker' NOT NULL,
	"pending_deleted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;