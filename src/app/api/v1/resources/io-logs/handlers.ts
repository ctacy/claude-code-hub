import type { Context } from "hono";
import { createProblemResponse } from "@/lib/api/v1/_shared/error-envelope";
import { decodeCursor, encodeCursor } from "@/lib/api/v1/_shared/pagination";
import { jsonResponse } from "@/lib/api/v1/_shared/response-helpers";
import { listIoLogs } from "@/repository/io-log-query";

export async function ioLogsHandler(c: Context): Promise<Response> {
  const limitRaw = c.req.query("limit");
  const cursorRaw = c.req.query("cursor");

  const limit = limitRaw ? Math.min(Math.max(parseInt(limitRaw, 10) || 50, 1), 200) : 50;

  let cursor: { createdAt: string; id: number } | null = null;
  if (cursorRaw) {
    const decoded = decodeCursor(cursorRaw);
    if (
      !decoded ||
      typeof decoded.createdAt !== "string" ||
      typeof decoded.id !== "number" ||
      !Number.isInteger(decoded.id)
    ) {
      return createProblemResponse({
        status: 400,
        instance: new URL(c.req.url).pathname,
        errorCode: "io_log.invalid_cursor",
        detail: "Cursor is invalid.",
      });
    }
    cursor = { createdAt: decoded.createdAt, id: decoded.id };
  }

  const result = await listIoLogs({ limit, cursor });

  return jsonResponse({
    items: result.items.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
    pageInfo: {
      nextCursor: result.nextCursor
        ? encodeCursor({ createdAt: result.nextCursor.createdAt, id: result.nextCursor.id })
        : null,
      hasMore: Boolean(result.nextCursor),
    },
  });
}
