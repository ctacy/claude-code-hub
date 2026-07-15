"use client";

import { IoLogsView } from "@/app/[locale]/dashboard/io-logs/_components/io-logs-view";
import { getPortalIoLogsBatch } from "@/lib/api-client/portal/io-logs";
import { searchPortalUsersForFilter } from "@/lib/api-client/portal/users";

export function PortalIoLogsView() {
  // AI Accept 2026-07-15 main v1
  return (
    <IoLogsView
      fetchLogs={getPortalIoLogsBatch}
      fetchUsers={searchPortalUsersForFilter}
      defaultAutoRefresh
    />
  );
}
