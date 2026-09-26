CREATE TYPE "persona_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "run_item_status" AS ENUM('pending', 'in_progress', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "run_status" AS ENUM('pending', 'in_progress', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "transcript_mode" AS ENUM('single', 'group');--> statement-breakpoint
CREATE TABLE "personas" (
	"id" uuid PRIMARY KEY DEFAULT generate_ulid(),
	"name" varchar(100) NOT NULL,
	"gender" text NOT NULL,
	"age" integer NOT NULL,
	"locale" varchar(20) DEFAULT 'vi-VN' NOT NULL,
	"region" varchar(20) NOT NULL,
	"income_bracket" varchar(100) NOT NULL,
	"occupation" varchar(100) NOT NULL,
	"background_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"personality_sliders" jsonb NOT NULL,
	"interview_stance" text NOT NULL,
	"quirks_freetext" text NOT NULL,
	"generated_bio" text,
	"system_prompt" text,
	"status" "persona_status" DEFAULT 'draft'::"persona_status" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_items" (
	"id" uuid PRIMARY KEY DEFAULT generate_ulid(),
	"run_id" uuid NOT NULL,
	"persona_id" uuid NOT NULL,
	"status" "run_item_status" DEFAULT 'pending'::"run_item_status" NOT NULL,
	"error" text,
	CONSTRAINT "run_items_run_persona_unique" UNIQUE("run_id","persona_id")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT generate_ulid(),
	"question_script" text[] NOT NULL,
	"persona_ids" uuid[] NOT NULL,
	"status" "run_status" DEFAULT 'pending'::"run_status" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" uuid PRIMARY KEY DEFAULT generate_ulid(),
	"persona_id" uuid NOT NULL,
	"run_id" uuid,
	"mode" "transcript_mode" NOT NULL,
	"turns" jsonb DEFAULT '[]' NOT NULL,
	"model" varchar(200) NOT NULL,
	"system_prompt" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "run_items" ADD CONSTRAINT "run_items_run_id_runs_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id");--> statement-breakpoint
ALTER TABLE "run_items" ADD CONSTRAINT "run_items_persona_id_personas_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id");--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_persona_id_personas_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id");--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_run_id_runs_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id");