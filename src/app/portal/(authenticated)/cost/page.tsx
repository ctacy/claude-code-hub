// AI Accept 2026-07-14 main v5
import { cookies } from "next/headers";
import { getExchangeRates } from "@/lib/portal/currency";
import { getCurrentCurrency } from "@/lib/portal/currency-cookie";
import {
  findAllTimeLeaderboard,
  findCustomRangeLeaderboard,
  findDailyLeaderboardWithWeekOverWeek,
  findPeriodLeaderboardWithPriorPeriod,
  type LeaderboardEntry,
} from "@/repository/leaderboard";
import { CurrencySwitcher } from "../_components/currency-switcher";
import { CostLeaderboardTable } from "./_components/cost-leaderboard-table";
import { CostPeriodBar } from "./_components/cost-period-bar";

export const dynamic = "force-dynamic";

type Period = "daily" | "weekly" | "monthly" | "allTime" | "custom";

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
  const cookieStore = await cookies();
  const currency = getCurrentCurrency(cookieStore);
  const rates = getExchangeRates();
  const hasCustomRange = isValidDateStr(startDate) && isValidDateStr(endDate);
  const currentPeriod: Period =
    period === "custom" && hasCustomRange
      ? "custom"
      : ["daily", "weekly", "monthly", "allTime"].includes(period ?? "")
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
            allTime: "全部",
          } as Record<Exclude<Period, "custom">, string>
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
        <CurrencySwitcher currentCurrency={currency} />
      </div>

      <CostLeaderboardTable
        rows={rows}
        periodLabel={periodLabel}
        currency={currency}
        rates={rates}
      />
    </div>
  );
}
