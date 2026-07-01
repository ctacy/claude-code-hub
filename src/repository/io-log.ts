import { db } from "@/drizzle/db";
import { requestIoLog } from "@/drizzle/io-log-schema";

/** Response body is truncated at this byte length before storage to prevent unbounded DB growth. */
export const IO_LOG_MAX_RESPONSE_BYTES = 1_000_000; // 1 MB

/**
 * Persist a single I/O log entry for one proxy request.
 * Called fire-and-forget from the response handler — errors are logged and swallowed.
 */
export async function insertRequestIoLog(params: {
  requestId: number;
  requestBody: string | null;
  responseBody: string | null;
  userName?: string | null;
  keyName?: string | null;
}): Promise<void> {
  const truncated =
    params.responseBody && params.responseBody.length > IO_LOG_MAX_RESPONSE_BYTES
      ? params.responseBody.slice(0, IO_LOG_MAX_RESPONSE_BYTES)
      : params.responseBody;

  await db.insert(requestIoLog).values({
    requestId: params.requestId,
    requestBody: params.requestBody ?? null,
    responseBody: truncated ?? null,
    userName: params.userName ?? null,
    keyName: params.keyName ?? null,
  });
}
