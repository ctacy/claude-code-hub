// AI Accept 2026-07-12 main v1
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  listAllUsersWithSummaryByDate,
  listLatestSummariesPerUser,
} from "@/repository/daily-work-summary";
import {
  listLatestPeriodSummariesPerUser,
  listPeriodSummariesByPeriod,
} from "@/repository/period-work-summary";
import { PeriodToolbar } from "./_components/period-toolbar";
import { SummaryCell } from "./_components/summary-cell";

export const dynamic = "force-dynamic";

type PeriodType = "day" | "week" | "month" | "year";

export default async function PortalSummariesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; period?: string; periodStart?: string }>;
}) {
  const { date, period, periodStart } = await searchParams;
  const dateValid = date && /^\d{4}-\d{2}-\d{2}$/.test(date);

  const currentPeriod: PeriodType = ["day", "week", "month", "year"].includes(period ?? "")
    ? (period as PeriodType)
    : "day";
  const periodStartValid = periodStart && /^\d{4}-\d{2}-\d{2}$/.test(periodStart);

  let rows: Array<{
    userName: string;
    date?: string;
    periodStart?: string;
    periodEnd?: string;
    requestCount: number | null;
    dayCount?: number;
    summaryText?: string;
  }> = [];

  if (currentPeriod === "day") {
    rows = dateValid
      ? await listAllUsersWithSummaryByDate(date)
      : await listLatestSummariesPerUser();
  } else if (periodStartValid) {
    const periodRows = await listPeriodSummariesByPeriod(
      currentPeriod as "week" | "month" | "year",
      periodStart
    );
    rows = periodRows.map((r) => ({
      userName: r.userName,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      requestCount: r.requestCount,
      dayCount: r.dayCount,
      summaryText: r.summaryText ?? undefined,
    }));
  } else {
    const periodRows = await listLatestPeriodSummariesPerUser(
      currentPeriod as "week" | "month" | "year"
    );
    rows = periodRows.map((r) => ({
      userName: r.userName,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      requestCount: r.requestCount,
      dayCount: r.dayCount,
      summaryText: r.summaryText ?? undefined,
    }));
  }

  const showDate = currentPeriod === "day";
  const showPeriod = currentPeriod !== "day";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">按用户工作总结</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {showDate && dateValid
            ? `展示 ${date} 当天所有用户的总结。`
            : showDate
              ? "每日凌晨自动生成，可按日期筛选或手动重新汇总。"
              : `展示 ${currentPeriod === "week" ? "每周" : currentPeriod === "month" ? "每月" : "每年"} 汇总总结。`}
        </p>
      </div>

      <PeriodToolbar />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {showDate && dateValid
              ? `${date} 暂无总结数据，可点击「重新汇总」立即生成。`
              : "暂无总结数据。请确认 ENABLE_IO_BODY_LOGGING 已开启，且定时任务已运行过至少一次。"}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <div className="bg-muted/30 border-b flex items-center h-9 text-xs font-medium text-muted-foreground/80">
            <div className="w-32 pl-3 shrink-0">用户</div>
            {showDate && (
              <>
                <div className="w-32 px-3 shrink-0">{dateValid ? "总结日期" : "最近总结日期"}</div>
                <div className="w-24 px-3 shrink-0">{dateValid ? "当日请求数" : "请求数"}</div>
              </>
            )}
            {showPeriod && (
              <>
                <div className="w-48 px-3 shrink-0">周期</div>
                <div className="w-24 px-3 shrink-0">天数</div>
                <div className="w-24 px-3 shrink-0">请求数</div>
              </>
            )}
            <div className="flex-1 px-3 pr-3">工作总结</div>
          </div>
          {rows.map((row) => {
            const hasData = row.requestCount !== null;
            const linkHref =
              showDate && hasData && row.date
                ? `/portal/summaries/${encodeURIComponent(row.userName)}/${row.date}`
                : "#";
            return (
              <Link
                key={`${row.userName}-${row.date ?? row.periodStart ?? ""}`}
                href={linkHref}
                className={`flex items-start min-h-11 text-sm border-b border-border/40 last:border-b-0 transition-colors ${
                  hasData && showDate && row.date ? "hover:bg-accent/50" : "pointer-events-none"
                }`}
              >
                <div className="w-32 pl-3 py-2 shrink-0 truncate">{row.userName}</div>
                {showDate && (
                  <>
                    <div className="w-32 px-3 py-2 shrink-0 font-mono text-xs text-muted-foreground">
                      {row.date}
                    </div>
                    <div className="w-24 px-3 py-2 shrink-0 text-muted-foreground">
                      {hasData ? row.requestCount : "—"}
                    </div>
                  </>
                )}
                {showPeriod && (
                  <>
                    <div className="w-48 px-3 py-2 shrink-0 font-mono text-xs text-muted-foreground">
                      {row.periodStart} ~ {row.periodEnd}
                    </div>
                    <div className="w-24 px-3 py-2 shrink-0 text-muted-foreground">
                      {row.dayCount ?? "—"}
                    </div>
                    <div className="w-24 px-3 py-2 shrink-0 text-muted-foreground">
                      {hasData ? row.requestCount : "—"}
                    </div>
                  </>
                )}
                <div className="flex-1 px-3 pr-3 py-2 text-xs text-muted-foreground">
                  {hasData && row.summaryText ? (
                    <SummaryCell text={row.summaryText} />
                  ) : showDate ? (
                    "当日无请求"
                  ) : (
                    "暂无数据"
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
