// AI Accept 2026-07-14 main v7
import { format, parseISO, subMonths, subWeeks, subYears } from "date-fns";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentCurrency } from "@/lib/portal/currency-cookie";
import { resolveSystemTimezone } from "@/lib/utils/timezone";
import {
  listAllUsersWithSummaryByDate,
  listLatestSummariesPerUser,
} from "@/repository/daily-work-summary";
import { type AuditFlags, auditFlagsForDate } from "@/repository/io-log-audit";
import {
  listLatestPeriodSummariesPerUser,
  listPeriodSummariesByPeriod,
} from "@/repository/period-work-summary";
import { CurrencySwitcher } from "../_components/currency-switcher";
import { ExportSummariesButton } from "./_components/export-summaries-button";
import { PeriodComparisonCard } from "./_components/period-comparison-card";
import { PeriodToolbar } from "./_components/period-toolbar";
import { type SummaryRow, SummaryTableClient } from "./_components/summary-table-client";

export const dynamic = "force-dynamic";

type PeriodType = "day" | "week" | "month" | "year";

/** 计算上一周期的 periodStart（YYYY-MM-DD） */
function getPriorPeriodStart(type: "week" | "month" | "year", periodStart: string): string {
  const d = parseISO(periodStart);
  switch (type) {
    case "week":
      return format(subWeeks(d, 1), "yyyy-MM-dd");
    case "month":
      return format(subMonths(d, 1), "yyyy-MM-dd");
    case "year":
      return format(subYears(d, 1), "yyyy-MM-dd");
  }
}

export default async function PortalSummariesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; period?: string; periodStart?: string }>;
}) {
  const { date, period, periodStart } = await searchParams;
  const cookieStore = await cookies();
  const currency = getCurrentCurrency(cookieStore);

  const currentPeriod: PeriodType = ["day", "week", "month", "year"].includes(period ?? "")
    ? (period as PeriodType)
    : "day";
  const effectiveDate =
    currentPeriod === "day"
      ? ((periodStart && /^\d{4}-\d{2}-\d{2}$/.test(periodStart) ? periodStart : undefined) ??
        (date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined))
      : undefined;
  const dateValid = !!effectiveDate;
  const periodStartValid = periodStart && /^\d{4}-\d{2}-\d{2}$/.test(periodStart);

  let rows: SummaryRow[] = [];

  let auditMap: Map<string, AuditFlags> | null = null;

  let priorPeriodData: {
    priorStart: string;
    currentTotal: number;
    priorTotal: number;
    delta: number | null;
  } | null = null;

  if (currentPeriod === "day") {
    if (dateValid) {
      const timezone = await resolveSystemTimezone();
      const [summaryRows, auditResult] = await Promise.all([
        listAllUsersWithSummaryByDate(effectiveDate!),
        auditFlagsForDate(effectiveDate!, timezone).catch(() => new Map<string, AuditFlags>()),
      ]);
      rows = summaryRows.map((r) => ({
        userName: r.userName,
        date: "date" in r ? r.date : undefined,
        requestCount: r.requestCount,
        summaryText: "summaryText" in r ? (r.summaryText ?? undefined) : undefined,
      }));
      auditMap = auditResult;
    } else {
      const latest = await listLatestSummariesPerUser();
      const fallbackDate = latest
        .map((r) => r.date)
        .filter((d): d is string => !!d)
        .sort()
        .pop();
      if (fallbackDate) {
        redirect(`/portal/summaries?period=day&periodStart=${fallbackDate}`);
      }
      rows = latest.map((r) => ({
        userName: r.userName,
        date: r.date,
        requestCount: r.requestCount,
        summaryText: r.summaryText,
      }));
    }
  } else if (periodStartValid) {
    const periodType = currentPeriod as "week" | "month" | "year";
    const priorStart = getPriorPeriodStart(periodType, periodStart);
    const [periodRows, priorRows] = await Promise.all([
      listPeriodSummariesByPeriod(periodType, periodStart),
      listPeriodSummariesByPeriod(periodType, priorStart),
    ]);
    rows = periodRows.map((r) => ({
      userName: r.userName,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      requestCount: r.requestCount,
      dayCount: r.dayCount,
      summaryText: r.summaryText ?? undefined,
    }));
    const currentTotal = periodRows.reduce((s, r) => s + (r.requestCount ?? 0), 0);
    const priorTotal = priorRows.reduce((s, r) => s + (r.requestCount ?? 0), 0);
    priorPeriodData = {
      priorStart,
      currentTotal,
      priorTotal,
      delta: priorTotal > 0 ? ((currentTotal - priorTotal) / priorTotal) * 100 : null,
    };
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
            ? `展示 ${effectiveDate} 当天所有用户的总结。`
            : showDate
              ? "每日凌晨自动生成，可按日期筛选或手动重新汇总。"
              : `展示 ${currentPeriod === "week" ? "每周" : currentPeriod === "month" ? "每月" : currentPeriod === "year" ? "每年" : "本周期"} 汇总总结。`}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <PeriodToolbar />
        <div className="flex items-center gap-2">
          <CurrencySwitcher currentCurrency={currency} />
          <ExportSummariesButton
            period={currentPeriod}
            periodStart={showPeriod ? periodStart : effectiveDate}
          />
        </div>
      </div>

      {showPeriod && priorPeriodData && (
        <PeriodComparisonCard
          periodType={currentPeriod as "week" | "month" | "year"}
          currentTotal={priorPeriodData.currentTotal}
          priorTotal={priorPeriodData.priorTotal}
          delta={priorPeriodData.delta}
          priorPeriodStart={priorPeriodData.priorStart}
        />
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {showDate && dateValid
              ? `${effectiveDate} 暂无总结数据，可点击「重新汇总」立即生成。`
              : "暂无总结数据。请确认 ENABLE_IO_BODY_LOGGING 已开启，且定时任务已运行过至少一次。"}
          </CardContent>
        </Card>
      ) : (
        <SummaryTableClient
          rows={rows}
          showDate={showDate}
          showPeriod={showPeriod}
          currentPeriod={currentPeriod}
          effectiveDate={effectiveDate}
          dateValid={dateValid}
          auditMap={auditMap}
        />
      )}
    </div>
  );
}
