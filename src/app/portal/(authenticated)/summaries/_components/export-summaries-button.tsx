// AI Accept 2026-07-14 main v1
"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type PeriodType = "day" | "week" | "month" | "year";

export function ExportSummariesButton({
  period,
  periodStart,
}: {
  period: PeriodType;
  periodStart?: string;
}) {
  function handleExport() {
    const params = new URLSearchParams();
    params.set("period", period);
    if (periodStart) params.set("periodStart", periodStart);
    window.location.href = `/api/portal/summaries/export?${params}`;
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download className="h-4 w-4 mr-1.5" />
      导出 CSV
    </Button>
  );
}
