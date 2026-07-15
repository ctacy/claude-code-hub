// AI Accept 2026-07-15 main v1
import {
  addDays,
  endOfMonth,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfYear,
  subMonths,
  subYears,
} from "date-fns";
import {
  findAllTimeLeaderboard,
  findCustomRangeLeaderboard,
  findDailyLeaderboardWithWeekOverWeek,
  findPeriodLeaderboardWithPriorPeriod,
  type LeaderboardEntry,
} from "@/repository/leaderboard";
import { CostLeaderboardTable } from "./_components/cost-leaderboard-table";
import { CostPeriodBar } from "./_components/cost-period-bar";

export const dynamic = "force-dynamic";

type Period = "daily" | "weekly" | "monthly" | "yearly" | "allTime" | "custom";
type NamedPeriod = "daily" | "weekly" | "monthly" | "yearly";
type RowEntry = LeaderboardEntry & { weekOverWeekDelta?: number | null };

function isValidDateStr(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function fmt(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function getPriorRange(
  period: NamedPeriod,
  startDate: string,
  endDate: string
): { startDate: string; endDate: string } {
  const start = parseISO(startDate);
  switch (period) {
    case "daily":
      return { startDate: fmt(addDays(start, -1)), endDate: fmt(addDays(start, -1)) };
    case "weekly":
      return {
        startDate: fmt(addDays(start, -7)),
        endDate: fmt(addDays(parseISO(endDate), -7)),
      };
    case "monthly": {
      const priorStart = startOfMonth(subMonths(start, 1));
      return { startDate: fmt(priorStart), endDate: fmt(endOfMonth(priorStart)) };
    }
    case "yearly": {
      const priorStart = startOfYear(subYears(start, 1));
      return { startDate: fmt(priorStart), endDate: fmt(endOfYear(priorStart)) };
    }
  }
}

async function queryWithComparison(
  period: NamedPeriod,
  startDate: string,
  endDate: string
): Promise<RowEntry[]> {
  const priorRange = getPriorRange(period, startDate, endDate);
  const [current, prior] = await Promise.all([
    findCustomRangeLeaderboard({ startDate, endDate }, undefined, true),
    findCustomRangeLeaderboard(priorRange, undefined, false),
  ]);
  const priorMap = new Map(prior.map((e) => [e.userId, e.totalCost]));
  return current.map((e) => {
    const priorCost = priorMap.get(e.userId) ?? 0;
    return {
      ...e,
      weekOverWeekDelta: priorCost > 0 ? ((e.totalCost - priorCost) / priorCost) * 100 : null,
    };
  });
}

// AI Accept 2026-07-15 main v1
export default async function PortalCostPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; startDate?: string; endDate?: string }>;
}) {
  const { period, startDate, endDate } = await searchParams;
  const hasCustomRange = isValidDateStr(startDate) && isValidDateStr(endDate);
  const currentPeriod: Period =
    period === "custom" && hasCustomRange
      ? "custom"
      : ["daily", "weekly", "monthly", "yearly", "allTime"].includes(period ?? "")
        ? (period as Period)
        : "daily";

  const rows = await (async (): Promise<RowEntry[]> => {
    switch (currentPeriod) {
      case "daily":
        // hasCustomRange → 导航到特定日（如昨日），与前一天对比
        if (hasCustomRange) return queryWithComparison("daily", startDate!, endDate!);
        return findDailyLeaderboardWithWeekOverWeek(undefined, true);
      case "weekly": {
        if (hasCustomRange) return queryWithComparison("weekly", startDate!, endDate!);
        const result = await findPeriodLeaderboardWithPriorPeriod("weekly", undefined, true);
        const priorMap = new Map(result.prior.map((e) => [e.userId, e.totalCost]));
        return result.current.map((e) => {
          const prior = priorMap.get(e.userId) ?? 0;
          return {
            ...e,
            weekOverWeekDelta: prior > 0 ? ((e.totalCost - prior) / prior) * 100 : null,
          };
        });
      }
      case "monthly": {
        if (hasCustomRange) return queryWithComparison("monthly", startDate!, endDate!);
        const result = await findPeriodLeaderboardWithPriorPeriod("monthly", undefined, true);
        const priorMap = new Map(result.prior.map((e) => [e.userId, e.totalCost]));
        return result.current.map((e) => {
          const prior = priorMap.get(e.userId) ?? 0;
          return {
            ...e,
            weekOverWeekDelta: prior > 0 ? ((e.totalCost - prior) / prior) * 100 : null,
          };
        });
      }
      case "yearly": {
        if (hasCustomRange) return queryWithComparison("yearly", startDate!, endDate!);
        const result = await findPeriodLeaderboardWithPriorPeriod("yearly", undefined, true);
        const priorMap = new Map(result.prior.map((e) => [e.userId, e.totalCost]));
        return result.current.map((e) => {
          const prior = priorMap.get(e.userId) ?? 0;
          return {
            ...e,
            weekOverWeekDelta: prior > 0 ? ((e.totalCost - prior) / prior) * 100 : null,
          };
        });
      }
      case "allTime":
        return findAllTimeLeaderboard(undefined, true);
      case "custom":
        return findCustomRangeLeaderboard(
          { startDate: startDate!, endDate: endDate! },
          undefined,
          true
        );
    }
  })();

  const periodLabel =
    currentPeriod === "custom"
      ? `${startDate} ~ ${endDate}`
      : (
          {
            daily: "今日",
            weekly: "本周",
            monthly: "本月",
            yearly: "本年",
            allTime: "全部",
          } as Record<Exclude<Period, "custom">, string>
        )[currentPeriod];

  const comparisonLabel: string | undefined = (
    {
      daily: "环比增长",
      weekly: "环比增长",
      monthly: "环比增长",
      yearly: "环比增长",
      allTime: undefined,
      custom: undefined,
    } as Record<Period, string | undefined>
  )[currentPeriod];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">用户成本榜</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {periodLabel} · 按消耗金额降序，数据来源 usage_ledger。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <CostPeriodBar />
      </div>

      <CostLeaderboardTable
        rows={rows}
        periodLabel={periodLabel}
        comparisonLabel={comparisonLabel}
      />
    </div>
  );
}
