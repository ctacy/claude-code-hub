"use server";

import { and, desc, eq, lt, or } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { requestIoLog } from "@/drizzle/io-log-schema";
import { messageRequest } from "@/drizzle/schema";

export type IoLogRow = {
  id: number;
  requestId: number;
  requestBody: string | null;
  responseBody: string | null;
  createdAt: Date;
  model: string | null;
  originalModel: string | null;
  statusCode: number | null;
};

export type IoLogListResult = {
  items: IoLogRow[];
  nextCursor: { createdAt: string; id: number } | null;
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function listIoLogs(params: {
  limit?: number | null;
  cursor?: { createdAt: string; id: number } | null;
}): Promise<IoLogListResult> {
  const limit = Math.min(params.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  const cursorCondition = params.cursor
    ? (() => {
        const cursorCreatedAt = new Date(params.cursor.createdAt);
        return or(
          lt(requestIoLog.createdAt, cursorCreatedAt),
          and(eq(requestIoLog.createdAt, cursorCreatedAt), lt(requestIoLog.id, params.cursor.id))
        );
      })()
    : undefined;

  const rows = await db
    .select({
      id: requestIoLog.id,
      requestId: requestIoLog.requestId,
      requestBody: requestIoLog.requestBody,
      responseBody: requestIoLog.responseBody,
      createdAt: requestIoLog.createdAt,
      model: messageRequest.model,
      originalModel: messageRequest.originalModel,
      statusCode: messageRequest.statusCode,
    })
    .from(requestIoLog)
    .leftJoin(messageRequest, eq(requestIoLog.requestId, messageRequest.id))
    .where(cursorCondition)
    .orderBy(desc(requestIoLog.createdAt), desc(requestIoLog.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last ? { createdAt: last.createdAt.toISOString(), id: last.id } : null;

  return { items: items as IoLogRow[], nextCursor };
}
