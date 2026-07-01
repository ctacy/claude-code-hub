/**
 * Request I/O Log Schema
 *
 * Separate from message_request to avoid conflicts with upstream maintenance.
 * Stores full request body (JSON) and response body (text) per request.
 * Controlled by env ENABLE_IO_BODY_LOGGING (default: false).
 */
import { index, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const requestIoLog = pgTable(
  "request_io_log",
  {
    id: serial("id").primaryKey(),
    /** FK to message_request.id (soft reference — avoids circular import and migration entanglement) */
    requestId: integer("request_id").notNull(),
    /** Last user message text (plain string, stripped of tools/system) */
    requestBody: text("request_body"),
    /** Full upstream response body; truncated at IO_LOG_MAX_RESPONSE_BYTES if oversized */
    responseBody: text("response_body"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** Snapshot of the user's display name at request time (null for pre-migration rows) */
    userName: varchar("user_name", { length: 255 }),
    /** Snapshot of the key's display name at request time (null for pre-migration rows) */
    keyName: varchar("key_name", { length: 255 }),
  },
  (table) => ({
    requestIoLogRequestIdIdx: index("idx_request_io_log_request_id").on(table.requestId),
    requestIoLogCreatedAtIdx: index("idx_request_io_log_created_at").on(table.createdAt),
  })
);
