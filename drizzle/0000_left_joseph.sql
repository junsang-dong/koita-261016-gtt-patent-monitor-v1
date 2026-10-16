--> statement-breakpoint
CREATE TYPE "gtt"."claim_source" AS ENUM('API', 'MANUAL_INPUT');--> statement-breakpoint
CREATE TYPE "gtt"."class_source" AS ENUM('AI', 'MANUAL');--> statement-breakpoint
CREATE TYPE "gtt"."event_type" AS ENUM('NEW', 'STATUS_CHANGED', 'REG_NO_ASSIGNED');--> statement-breakpoint
CREATE TYPE "gtt"."family" AS ENUM('NO96', 'MK3', 'FLEX', 'SLIM', 'GST', 'ETC', 'UNCLASSIFIED');--> statement-breakpoint
CREATE TYPE "gtt"."layer" AS ENUM('L1', 'L2', 'L3', 'L4', 'UNCLASSIFIED');--> statement-breakpoint
CREATE TYPE "gtt"."risk" AS ENUM('HIGH', 'MID', 'LOW');--> statement-breakpoint
CREATE TYPE "gtt"."run_state" AS ENUM('RUNNING', 'DONE', 'FAILED', 'PARTIAL');--> statement-breakpoint
CREATE TYPE "gtt"."run_trigger" AS ENUM('CRON', 'MANUAL');--> statement-breakpoint
CREATE TYPE "gtt"."status_group" AS ENUM('valid', 'pending', 'inactive');--> statement-breakpoint
CREATE TYPE "gtt"."verified" AS ENUM('API', 'WEB', 'UNVERIFIED');--> statement-breakpoint
CREATE TABLE "gtt"."applicant_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"alias" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_hit_count" integer,
	CONSTRAINT "applicant_aliases_alias_unique" UNIQUE("alias")
);
--> statement-breakpoint
CREATE TABLE "gtt"."claim_charts" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_no" text NOT NULL,
	"claim_no" integer NOT NULL,
	"other_independent" integer[],
	"elements" jsonb NOT NULL,
	"element_count" integer NOT NULL,
	"key_limiting" text,
	"review_ideas" text,
	"claim_source" "gtt"."claim_source" NOT NULL,
	"model" text,
	"prompt_version" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gtt"."classifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_no" text NOT NULL,
	"family" "gtt"."family" NOT NULL,
	"layer" "gtt"."layer" NOT NULL,
	"evidence" jsonb,
	"confidence" numeric(4, 3),
	"model" text,
	"prompt_version" text,
	"source" "gtt"."class_source" DEFAULT 'AI' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gtt"."monitor_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"app_no" text NOT NULL,
	"type" "gtt"."event_type" NOT NULL,
	"before" text,
	"after" text,
	"acknowledged" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gtt"."monitor_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"trigger" "gtt"."run_trigger" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now(),
	"finished_at" timestamp with time zone,
	"state" "gtt"."run_state" DEFAULT 'RUNNING' NOT NULL,
	"cursor" jsonb,
	"stats" jsonb,
	"api_calls" integer DEFAULT 0 NOT NULL,
	"error" text,
	"report_md" text
);
--> statement-breakpoint
CREATE TABLE "gtt"."patent_status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_no" text NOT NULL,
	"run_id" integer,
	"field" text NOT NULL,
	"before" text,
	"after" text,
	"detected_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gtt"."patents" (
	"app_no" text PRIMARY KEY NOT NULL,
	"app_date" date,
	"title" text NOT NULL,
	"applicant" text,
	"ipc" text[],
	"pub_no" text,
	"pub_date" date,
	"reg_no" text,
	"reg_date" date,
	"status" text,
	"status_group" "gtt"."status_group",
	"abstract" text,
	"family" "gtt"."family" DEFAULT 'UNCLASSIFIED',
	"layer" "gtt"."layer" DEFAULT 'UNCLASSIFIED',
	"risk" "gtt"."risk",
	"risk_provisional" boolean DEFAULT true,
	"verified" "gtt"."verified" DEFAULT 'UNVERIFIED',
	"first_seen" timestamp with time zone DEFAULT now(),
	"last_checked" timestamp with time zone,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "gtt"."settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gtt"."claim_charts" ADD CONSTRAINT "claim_charts_app_no_patents_app_no_fk" FOREIGN KEY ("app_no") REFERENCES "gtt"."patents"("app_no") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtt"."classifications" ADD CONSTRAINT "classifications_app_no_patents_app_no_fk" FOREIGN KEY ("app_no") REFERENCES "gtt"."patents"("app_no") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtt"."monitor_events" ADD CONSTRAINT "monitor_events_run_id_monitor_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "gtt"."monitor_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtt"."monitor_events" ADD CONSTRAINT "monitor_events_app_no_patents_app_no_fk" FOREIGN KEY ("app_no") REFERENCES "gtt"."patents"("app_no") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtt"."patent_status_history" ADD CONSTRAINT "patent_status_history_app_no_patents_app_no_fk" FOREIGN KEY ("app_no") REFERENCES "gtt"."patents"("app_no") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtt"."patent_status_history" ADD CONSTRAINT "patent_status_history_run_id_monitor_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "gtt"."monitor_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patents_status_risk_idx" ON "gtt"."patents" USING btree ("status_group","risk");--> statement-breakpoint
CREATE INDEX "patents_family_layer_idx" ON "gtt"."patents" USING btree ("family","layer");--> statement-breakpoint
CREATE INDEX "patents_app_date_idx" ON "gtt"."patents" USING btree ("app_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "patents_title_trgm_idx" ON "gtt"."patents" USING gin ("title" gin_trgm_ops);