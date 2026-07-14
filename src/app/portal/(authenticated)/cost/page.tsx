import {
  findAllTimeLeaderboard,
  findDailyLeaderboard,
  findMonthlyLeaderboard,
  findWeeklyLeaderboard,
} from "@/repository/leaderboard";
import { CostPeriodBar } from "./_components/cost-period-bar";

export const dynamic = "force-dynamic";

type Period = "daily" | "weekly" | "monthly" | "allTime";

function formatCost(usd: number): string {
  if (usd === 0) return "$0.0000";
  if (usd < 0.0001) return `$${usd.toExponential(2)}`;
  return `$${usd.toFixed(4)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const PERIOD_LABEL: Record<Period, string> = {
  daily: "今日",
  weekly: "本周",
  monthly: "本月",
  allTime: "全部",
};

export default async function PortalCostPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const currentPeriod: Period = ["daily", "weekly", "monthly", "allTime"].includes(period ?? "")
    ? (period as Period)
    : "daily";

  const rows = await (() => {
    switch (currentPeriod) {
      case "weekly":
        return findWeeklyLeaderboard();
      case "monthly":
        return findMonthlyLeaderboard();
      case "allTime":
        return findAllTimeLeaderboard();
      default:
        return findDailyLeaderboard();
    }
  })();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">用户成本榜</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {PERIOD_LABEL[currentPeriod]} · 按消耗金额降序，数据来源 usage_ledger。
        </p>
      </div>

      <CostPeriodBar />

      {rows.length === 0 ? (
        <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
          {PERIOD_LABEL[currentPeriod]}暂无消耗数据。
        </div>
      ) : (
        <div className="rounded-md border">
          <div className="bg-muted/30 border-b flex items-center h-9 text-xs font-medium text-muted-foreground/80">
            <div className="w-10 pl-3 shrink-0 text-right">#</div>
            <div className="flex-1 px-3">用户</div>
            <div className="w-28 px-3 shrink-0 text-right">请求数</div>
            <div className="w-28 px-3 shrink-0 text-right">Token 用量</div>
            <div className="w-32 px-3 pr-4 shrink-0 text-right">消耗（USD）</div>
          </div>
          {rows.map((row, idx) => (
            <div
              key={row.userId}
              className="flex items-center h-10 text-sm border-b border-border/40 last:border-b-0 hover:bg-muted/20"
            >
              <div className="w-10 pl-3 shrink-0 text-right text-muted-foreground text-xs">
                {idx + 1}
              </div>
              <div className="flex-1 px-3 truncate">{row.userName}</div>
              <div className="w-28 px-3 shrink-0 text-right text-muted-foreground">
                {row.totalRequests.toLocaleString()}
              </div>
              <div className="w-28 px-3 shrink-0 text-right text-muted-foreground font-mono text-xs">
                {formatTokens(row.totalTokens)}
              </div>
              <div className="w-32 px-3 pr-4 shrink-0 text-right font-mono font-semibold">
                {formatCost(row.totalCost)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
