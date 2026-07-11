DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'request_io_log' AND column_name = 'user_name'
  ) THEN
    ALTER TABLE "request_io_log" ADD COLUMN "user_name" varchar(255);
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'request_io_log' AND column_name = 'key_name'
  ) THEN
    ALTER TABLE "request_io_log" ADD COLUMN "key_name" varchar(255);
  END IF;
END $$;
