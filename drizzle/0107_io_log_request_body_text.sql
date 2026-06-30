ALTER TABLE "request_io_log" ALTER COLUMN "request_body" TYPE text USING "request_body"::text;
