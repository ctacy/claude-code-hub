"use client";

import {
  apiGet,
  searchParams,
  toActionResult,
  unwrapItems,
} from "@/lib/api-client/v1/actions/_compat";

export function searchPortalUsersForFilter(query?: string, limit?: number) {
  return toActionResult(
    apiGet<{ items?: Array<{ id: number; name: string }> }>(
      `/api/portal/users${searchParams({ q: query, limit })}`
    ).then((body) => unwrapItems(body))
  );
}
