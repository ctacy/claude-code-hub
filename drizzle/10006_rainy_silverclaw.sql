-- AI Accept 2026-07-12 main v2
CREATE TABLE "period_work_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_name" varchar(255) NOT NULL,
	"period_type" varchar(10) NOT NULL,
	"period_start" varchar(10) NOT NULL,
	"period_end" varchar(10) NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"day_count" integer DEFAULT 0 NOT NULL,
	"tags_debugging" integer DEFAULT 0 NOT NULL,
	"tags_documentation" integer DEFAULT 0 NOT NULL,
	"tags_code_gen" integer DEFAULT 0 NOT NULL,
	"tags_refactor" integer DEFAULT 0 NOT NULL,
	"tags_testing" integer DEFAULT 0 NOT NULL,
	"tags_other" integer DEFAULT 0 NOT NULL,
	"summary_text" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"model" varchar(255),
	"provider_id" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_period_work_summary_user_period" ON "period_work_summary" USING btree ("user_name","period_type","period_start");
--> statement-breakpoint
CREATE INDEX "idx_period_work_summary_period" ON "period_work_summary" USING btree ("period_type","period_start");
