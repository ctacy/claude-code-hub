// AI Accept 2026-07-14 main v6
import { format, parseISO, subMonths, subWeeks, subYears } from "date-fns";
import { cookies } from "next/headers";
import Link from "next/link";
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
import { CopySummaryButton } from "./_components/copy-summary-button";
import { ExportSummariesButton } from "./_components/export-summaries-button";
import { PeriodComparisonCard } from "./_components/period-comparison-card";
import { PeriodToolbar } from "./_components/period-toolbar";
import { SummaryCell } from "./_components/summary-cell";

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
  // 日模式下优先使用 periodStart（新 toolbar 命名），其次兼容旧的 date 参数
  const effectiveDate =
    currentPeriod === "day"
      ? ((periodStart && /^\d{4}-\d{2}-\d{2}$/.test(periodStart) ? periodStart : undefined) ??
        (date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined))
      : undefined;
  const dateValid = !!effectiveDate;
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

  // 审计数据：仅日模式+指定日期时拉取，与主数据并发
  let auditMap: Map<string, AuditFlags> | null = null;

  // 上一周期对比数据（仅周/月/年 + 有效 periodStart 时填充）
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
      rows = summaryRows;
      auditMap = auditResult;
    } else {
      // 默认入口：跳到库里"最近有数据的日"，与 toolbar 今日显示对齐
      const latest = await listLatestSummariesPerUser();
      const fallbackDate = latest
        .map((r) => r.date)
        .filter((d): d is string => !!d)
        .sort()
        .pop();
      if (fallbackDate) {
        redirect(`/portal/summaries?period=day&periodStart=${fallbackDate}`);
      }
      rows = latest;
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
              : `展示 ${currentPeriod === "week" ? "每周" : currentPeriod === "month" ? "每月" : "每年"} 汇总总结。`}
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
        <div className="rounded-md border">
          <div className="bg-muted/30 border-b flex items-center h-9 text-xs font-medium text-muted-foreground/80">
            <div className="w-32 pl-3 shrink-0">用户</div>
            {showDate && (
              <>
                <div className="w-32 px-3 shrink-0">{dateValid ? "总结日期" : "最近总结日期"}</div>
                <div className="w-24 px-3 shrink-0">{dateValid ? "当日请求数" : "请求数"}</div>
                {auditMap && <div className="w-40 px-3 shrink-0">无效率</div>}
              </>
            )}
            {showPeriod && (
              <>
                <div className="w-48 px-3 shrink-0">周期</div>
                <div className="w-24 px-3 shrink-0">天数</div>
                <div className="w-24 px-3 shrink-0">请求数</div>
              </>
            )}
            <div className="flex-1 px-3">工作总结</div>
            <div className="w-10 shrink-0" />
          </div>
          {rows.map((row) => {
            const hasData = row.requestCount !== null;
            const inner = (
              <>
                <div className="w-32 pl-3 py-2 shrink-0 truncate">{row.userName}</div>
                {showDate && (
                  <>
                    <div className="w-32 px-3 py-2 shrink-0 font-mono text-xs text-muted-foreground">
                      {row.date}
                    </div>
                    <div className="w-24 px-3 py-2 shrink-0 text-muted-foreground">
                      {hasData ? row.requestCount : "—"}
                    </div>
                    {auditMap &&
                      (() => {
                        const af = auditMap.get(row.userName);
                        if (!af || af.total === 0) {
                          return (
                            <div className="w-40 px-3 py-2 shrink-0 text-muted-foreground/50">
                              —
                            </div>
                          );
                        }
                        return (
                          <div className="w-40 px-3 py-2 shrink-0 flex flex-wrap gap-1">
                            {af.repeatedBlast > 0 && (
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                                重{af.repeatedBlast}
                              </span>
                            )}
                            {af.emptyOutput > 0 && (
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400">
                                空{af.emptyOutput}
                              </span>
                            )}
                            {af.hugeInput > 0 && (
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
                                巨{af.hugeInput}
                              </span>
                            )}
                          </div>
                        );
                      })()}
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
                <div className="flex-1 px-3 py-2 text-xs text-muted-foreground">
                  {hasData && row.summaryText ? (
                    <SummaryCell text={row.summaryText} />
                  ) : showDate ? (
                    "当日无请求"
                  ) : (
                    "暂无数据"
                  )}
                </div>
              </>
            );

            const rowClass =
              "flex items-start min-h-11 text-sm border-b border-border/40 last:border-b-0";
            const copyCell = (
              <div className="w-10 shrink-0 py-2 flex justify-center">
                {hasData && row.summaryText && <CopySummaryButton text={row.summaryText} />}
              </div>
            );

            if (showPeriod) {
              const linkHref =
                hasData && row.periodStart
                  ? `/portal/summaries/period/${currentPeriod}/${row.periodStart}/${encodeURIComponent(row.userName)}`
                  : "#";
              return (
                <div
                  key={`${row.userName}-${row.periodStart ?? ""}`}
                  className={`${rowClass} transition-colors ${hasData && row.periodStart ? "hover:bg-accent/50" : ""}`}
                >
                  <Link
                    href={linkHref}
                    className={`flex flex-1 items-start ${
                      hasData && row.periodStart ? "" : "pointer-events-none"
                    }`}
                  >
                    {inner}
                  </Link>
                  {copyCell}
                </div>
              );
            }

            const linkHref =
              hasData && row.date
                ? `/portal/summaries/${encodeURIComponent(row.userName)}/${row.date}`
                : "#";
            return (
              <div
                key={`${row.userName}-${row.date ?? ""}`}
                className={`${rowClass} transition-colors ${hasData && row.date ? "hover:bg-accent/50" : ""}`}
              >
                <Link
                  href={linkHref}
                  className={`flex flex-1 items-start ${
                    hasData && row.date ? "" : "pointer-events-none"
                  }`}
                >
                  {inner}
                </Link>
                {copyCell}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
