CREATE TABLE IF NOT EXISTS "request_io_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"request_body" text,
	"response_body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_name" varchar(255),
	"key_name" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_work_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_name" varchar(255) NOT NULL,
	"date" varchar(10) NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"tags_debugging" integer DEFAULT 0 NOT NULL,
	"tags_documentation" integer DEFAULT 0 NOT NULL,
	"tags_code_gen" integer DEFAULT 0 NOT NULL,
	"tags_refactor" integer DEFAULT 0 NOT NULL,
	"tags_testing" integer DEFAULT 0 NOT NULL,
	"tags_other" integer DEFAULT 0 NOT NULL,
	"summary_text" text NOT NULL,
	"provider_id" integer,
	"model" varchar(128),
	"input_tokens" integer,
	"output_tokens" integer,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_request_io_log_request_id" ON "request_io_log" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_request_io_log_created_at" ON "request_io_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_daily_work_summary_user_date" ON "daily_work_summary" USING btree ("user_name","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_daily_work_summary_date" ON "daily_work_summary" USING btree ("date");