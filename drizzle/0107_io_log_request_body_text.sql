DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'request_io_log'
      AND column_name = 'request_body'
      AND data_type = 'jsonb'
  ) THEN
    ALTER TABLE "request_io_log" ALTER COLUMN "request_body" TYPE text USING "request_body"::text;
  END IF;
END $$;
