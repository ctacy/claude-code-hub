"use client";

import { apiGet, searchParams, toActionResult } from "@/lib/api-client/v1/actions/_compat";
import type { IoLogListResult } from "@/lib/api-client/v1/actions/io-logs";

export type { IoLogItem } from "@/lib/api-client/v1/actions/io-logs";

export function getPortalIoLogsBatch(params?: {
  cursor?: string | null;
  limit?: number;
  userName?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  keyword?: string | null;
}) {
  return toActionResult(
    apiGet<IoLogListResult>(
      `/api/portal/io-logs${searchParams({
        cursor: params?.cursor ?? undefined,
        limit: params?.limit ?? undefined,
        userName: params?.userName ?? undefined,
        startTime: params?.startTime ?? undefined,
        endTime: params?.endTime ?? undefined,
        keyword: params?.keyword ?? undefined,
      })}`
    )
  );
}
