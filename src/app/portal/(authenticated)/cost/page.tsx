// AI Accept 2026-07-14 main v3
import {
  findAllTimeLeaderboard,
  findCustomRangeLeaderboard,
  findDailyLeaderboard,
  findMonthlyLeaderboard,
  findWeeklyLeaderboard,
} from "@/repository/leaderboard";
import { CostLeaderboardTable } from "./_components/cost-leaderboard-table";
import { CostPeriodBar } from "./_components/cost-period-bar";

export const dynamic = "force-dynamic";

type Period = "daily" | "weekly" | "monthly" | "allTime" | "custom";

function isValidDateStr(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

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
      : ["daily", "weekly", "monthly", "allTime"].includes(period ?? "")
        ? (period as Period)
        : "daily";

  const rows = await (() => {
    switch (currentPeriod) {
      case "weekly":
        return findWeeklyLeaderboard(undefined, true);
      case "monthly":
        return findMonthlyLeaderboard(undefined, true);
      case "allTime":
        return findAllTimeLeaderboard(undefined, true);
      case "custom":
        return findCustomRangeLeaderboard(
          { startDate: startDate!, endDate: endDate! },
          undefined,
          true
        );
      default:
        return findDailyLeaderboard(undefined, true);
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

      <CostPeriodBar />

      <CostLeaderboardTable rows={rows} periodLabel={periodLabel} />
    </div>
  );
}
