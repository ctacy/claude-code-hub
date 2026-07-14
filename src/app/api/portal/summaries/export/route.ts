// AI Accept 2026-07-14 main v1
import { type NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/auth/require-portal-session";
import {
  listAllUsersWithSummaryByDate,
  listLatestSummariesPerUser,
} from "@/repository/daily-work-summary";
import {
  listLatestPeriodSummariesPerUser,
  listPeriodSummariesByPeriod,
} from "@/repository/period-work-summary";

export const runtime = "nodejs";

type PeriodType = "day" | "week" | "month" | "year";

/** CSV 字段转义：含逗号/引号/换行时用双引号包裹，内部双引号转义为两个双引号 */
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(fields: Array<string | number | null | undefined>): string {
  return fields.map((f) => csvEscape(f === null || f === undefined ? "" : String(f))).join(",");
}

export async function GET(request: NextRequest) {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period");
  const periodStartParam = searchParams.get("periodStart");
  const dateParam = searchParams.get("date");

  const currentPeriod: PeriodType = ["day", "week", "month", "year"].includes(period ?? "")
    ? (period as PeriodType)
    : "day";

  const isValidDateStr = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

  let filenameSuffix: string;
  let csv: string;

  if (currentPeriod === "day") {
    const effectiveDate = isValidDateStr(periodStartParam)
      ? periodStartParam
      : isValidDateStr(dateParam)
        ? dateParam
        : undefined;
    const rows = effectiveDate
      ? await listAllUsersWithSummaryByDate(effectiveDate)
      : await listLatestSummariesPerUser();

    filenameSuffix = effectiveDate ?? "latest";
    const header = toCsvRow(["用户", "日期", "请求数", "工作总结"]);
    const lines = rows.map((r) =>
      toCsvRow([
        r.userName,
        "date" in r ? r.date : undefined,
        r.requestCount,
        "summaryText" in r ? r.summaryText : undefined,
      ])
    );
    csv = [header, ...lines].join("\r\n");
  } else {
    const rows = isValidDateStr(periodStartParam)
      ? await listPeriodSummariesByPeriod(currentPeriod, periodStartParam)
      : await listLatestPeriodSummariesPerUser(currentPeriod);

    filenameSuffix = periodStartParam ?? "latest";
    const header = toCsvRow(["用户", "周期开始", "周期结束", "天数", "请求数", "工作总结"]);
    const lines = rows.map((r) =>
      toCsvRow([r.userName, r.periodStart, r.periodEnd, r.dayCount, r.requestCount, r.summaryText])
    );
    csv = [header, ...lines].join("\r\n");
  }

  // 加 UTF-8 BOM（﻿），确保 Excel 打开时中文不乱码
  const bom = "﻿";
  const filename = `summaries-${currentPeriod}-${filenameSuffix}.csv`;

  return new NextResponse(bom + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
