/**
 * Request I/O Logging — fire-and-forget hook
 *
 * Controlled by env ENABLE_IO_BODY_LOGGING (default: false).
 * All logic lives here; callers only import this one function.
 */
import type { ProxySession } from "@/app/v1/_lib/proxy/session";
import { getEnvConfig } from "@/lib/config/env.schema";
import { logger } from "@/lib/logger";
import { insertRequestIoLog } from "@/repository/io-log";

/**
 * Write the full request + response body to `request_io_log`.
 *
 * - Guarded by `ENABLE_IO_BODY_LOGGING` env flag (off by default).
 * - Fire-and-forget: never throws, never awaited on the hot path.
 * - Safe to call from both streaming and non-streaming handlers.
 *
 * @param session      Proxy session — provides `session.request.message` as input body.
 * @param requestId    `message_request.id` used as the FK reference.
 * @param responseText Full response body (SSE text for streaming, JSON text for non-streaming).
 */
export function fireAndForgetIoLog(
  session: ProxySession,
  requestId: number,
  responseText: string
): void {
  if (!getEnvConfig().ENABLE_IO_BODY_LOGGING) return;

  const requestBody = (session.request.message as Record<string, unknown> | null) ?? null;

  insertRequestIoLog({ requestId, requestBody, responseBody: responseText }).catch((err) => {
    logger.warn("[IoLog] Failed to persist request I/O log", {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}
