-- AI Accept 2026-07-12 main v1
CREATE TABLE "cloud_pricing_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" varchar(64) NOT NULL,
	"currency" varchar(16) DEFAULT 'USD' NOT NULL,
	"refreshed_at" timestamp with time zone,
	"providers" jsonb NOT NULL,
	"vendors" jsonb NOT NULL,
	"model_count" integer DEFAULT 0 NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
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
ALTER TABLE "model_prices" ALTER COLUMN "source" SET DEFAULT 'cloud';--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "codex_image_generation_preference" varchar(10);--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "enable_gemini_function_id_rectifier" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_period_work_summary_user_period" ON "period_work_summary" USING btree ("user_name","period_type","period_start");--> statement-breakpoint
CREATE INDEX "idx_period_work_summary_period" ON "period_work_summary" USING btree ("period_type","period_start");--> statement-breakpoint
CREATE INDEX "idx_model_prices_vendor" ON "model_prices" USING btree ((("price_data" ->> 'vendor')));--> statement-breakpoint
CREATE INDEX "idx_model_prices_aliases" ON "model_prices" USING gin ((("price_data" -> 'aliases')));