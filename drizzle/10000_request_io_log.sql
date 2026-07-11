CREATE TABLE IF NOT EXISTS "request_io_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"request_body" jsonb,
	"response_body" text,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_request_io_log_request_id" ON "request_io_log" USING btree ("request_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_request_io_log_created_at" ON "request_io_log" USING btree ("created_at");
