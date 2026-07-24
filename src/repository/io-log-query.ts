"use server";

import { and, desc, eq, gte, ilike, lt, lte, or } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { requestIoLog } from "@/drizzle/io-log-schema";
import { messageRequest } from "@/drizzle/schema";
import type { ProviderChainItem } from "@/types/message";

export type IoLogRow = {
  id: number;
  requestId: number;
  requestBody: string | null;
  responseBody: string | null;
  createdAt: Date;
  model: string | null;
  originalModel: string | null;
  statusCode: number | null;
  userName: string | null;
  keyName: string | null;
  providerChain: ProviderChainItem[] | null;
};

export type IoLogListResult = {
  items: IoLogRow[];
  nextCursor: { createdAt: string; id: number } | null;
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

// AI Accept 2026-07-08 main v1
export async function listIoLogs(params: {
  limit?: number | null;
  cursor?: { createdAt: string; id: number } | null;
  userName?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  keyword?: string | null;
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

  const keywordCondition = params.keyword?.trim()
    ? or(
        ilike(requestIoLog.requestBody, `%${params.keyword.trim()}%`),
        ilike(requestIoLog.responseBody, `%${params.keyword.trim()}%`)
      )
    : undefined;

  const whereCondition = and(
    cursorCondition,
    params.userName ? eq(requestIoLog.userName, params.userName) : undefined,
    params.startTime ? gte(requestIoLog.createdAt, new Date(params.startTime)) : undefined,
    params.endTime ? lte(requestIoLog.createdAt, new Date(params.endTime)) : undefined,
    keywordCondition
  );

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
      userName: requestIoLog.userName,
      keyName: requestIoLog.keyName,
      providerChain: messageRequest.providerChain,
    })
    .from(requestIoLog)
    .leftJoin(messageRequest, eq(requestIoLog.requestId, messageRequest.id))
    .where(whereCondition)
    .orderBy(desc(requestIoLog.createdAt), desc(requestIoLog.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last ? { createdAt: last.createdAt.toISOString(), id: last.id } : null;

  return { items: items as IoLogRow[], nextCursor };
}
