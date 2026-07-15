// AI Accept 2026-07-14 main v6
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

function isValidDateStr(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// AI Accept 2026-07-14 main v5
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

  // 带周同比/环比的行数据
  type RowEntry = LeaderboardEntry & { weekOverWeekDelta?: number | null };

  const rows = await (async (): Promise<RowEntry[]> => {
    switch (currentPeriod) {
      case "daily":
        return findDailyLeaderboardWithWeekOverWeek(undefined);
      case "weekly": {
        const result = await findPeriodLeaderboardWithPriorPeriod("weekly", undefined);
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
        const result = await findPeriodLeaderboardWithPriorPeriod("monthly", undefined);
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
        const result = await findPeriodLeaderboardWithPriorPeriod("yearly", undefined);
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

  // 对比列表头文案：daily 与昨日对比，weekly 与上一周对比，monthly 与上一月对比，
  // 均为相邻同长度周期比较，统一称"环比增长"；allTime/custom 无对比基准，不显示该列
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
