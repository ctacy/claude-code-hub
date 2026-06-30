"use server";

import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { requestIoLog } from "@/drizzle/io-log-schema";
import { messageRequest } from "@/drizzle/schema";

export type IoLogRow = {
  id: number;
  requestId: number;
  requestBody: Record<string, unknown> | null;
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
    ? or(
        lt(requestIoLog.createdAt, new Date(params.cursor.createdAt)),
        and(
          sql`${requestIoLog.createdAt} = ${new Date(params.cursor.createdAt)}`,
          lt(requestIoLog.id, params.cursor.id)
        )
      )
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
