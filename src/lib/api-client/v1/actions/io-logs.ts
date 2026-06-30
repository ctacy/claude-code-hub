import type { IoLogRow } from "@/repository/io-log-query";
import { apiGet, searchParams, toActionResult } from "./_compat";

export type IoLogItem = IoLogRow & { createdAt: string };

export type IoLogListResult = {
  items: IoLogItem[];
  pageInfo: {
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export function getIoLogsBatch(params?: { cursor?: string | null; limit?: number }) {
  return toActionResult(
    apiGet<IoLogListResult>(
      `/api/v1/io-logs${searchParams({
        cursor: params?.cursor ?? undefined,
        limit: params?.limit ?? undefined,
      })}`
    )
  );
}
