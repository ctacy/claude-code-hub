// AI Accept 2026-07-16 main v1
import {
  Activity,
  BarChart3,
  CalendarDays,
  CalendarRange,
  Coins,
  DollarSign,
  Layers,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { aggregateDailyTotals, getWeeklyCostProfile } from "@/lib/portal/dashboard-profile";
import {
  getLatestDailySummaryRun,
  type LatestDailySummaryRun,
} from "@/repository/daily-work-summary";
import { findDailyLeaderboard, findMonthlyLeaderboard } from "@/repository/leaderboard";
import {
  getLatestPeriodSummaryRun,
  type LatestPeriodSummaryRun,
} from "@/repository/period-work-summary";
import { getUserStatisticsFromDB } from "@/repository/statistics";
import type { TimeRange } from "@/types/statistics";
import { WeeklyCostBar } from "./_components/weekly-cost-bar";
import { WeeklyTrendChart } from "./_components/weekly-trend-chart";

export const dynamic = "force-dynamic";

function formatUsd(amount: number): string {
  return `$${amount.toFixed(4)}`;
}

// AI Accept 2026-07-16 main v1
function SummaryJobCard({ run }: { run: LatestDailySummaryRun | null }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          日报汇总任务
        </CardTitle>
      </CardHeader>
      <CardContent>
        {run ? (
          <div>
            <div className="text-base font-semibold text-green-600">完成</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {run.date}
              {` · 生成于 ${new Date(run.generatedAt).toLocaleString("zh-CN")}`}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{`共 ${run.userCount} 位用户`}</p>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">暂无记录</div>
        )}
      </CardContent>
    </Card>
  );
}

// AI Accept 2026-07-16 main v1
function PeriodJobCard({ run }: { run: LatestPeriodSummaryRun | null }) {
  const PERIOD_LABEL: Record<string, string> = { week: "周", month: "月", year: "年" };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <CalendarRange className="h-4 w-4" />
          周期汇总任务
        </CardTitle>
      </CardHeader>
      <CardContent>
        {run ? (
          <div>
            <div className="text-base font-semibold text-green-600">完成</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {`${PERIOD_LABEL[run.periodType] ?? run.periodType} · ${run.periodStart}`}
              {run.updatedAt ? ` · 生成于 ${new Date(run.updatedAt).toLocaleString("zh-CN")}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{`共 ${run.userCount} 位用户`}</p>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">暂无记录</div>
        )}
      </CardContent>
    </Card>
  );
}

// AI Accept 2026-07-16 main v1
const VALID_TREND_RANGES: TimeRange[] = ["today", "7days", "30days", "thisMonth"];

function parseTrendRange(value: string | undefined): TimeRange {
  return VALID_TREND_RANGES.includes(value as TimeRange) ? (value as TimeRange) : "7days";
}

export default async function PortalDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ trend?: string }>;
}) {
  const { trend } = await searchParams;
  const trendRange = parseTrendRange(trend);

  const [dailyRows, monthlyRows, latestSummaryRun, latestPeriodRun, weeklyCostRows, trendRows] =
    await Promise.all([
      findDailyLeaderboard(),
      findMonthlyLeaderboard(),
      getLatestDailySummaryRun(),
      getLatestPeriodSummaryRun(),
      getWeeklyCostProfile(),
      getUserStatisticsFromDB(trendRange),
    ]);

  const todayCost = dailyRows.reduce((sum, r) => sum + r.totalCost, 0);
  const todayRequests = dailyRows.reduce((sum, r) => sum + r.totalRequests, 0);
  const monthCost = monthlyRows.reduce((sum, r) => sum + r.totalCost, 0);
  // AI Accept 2026-07-16 main v1
  const monthRequests = monthlyRows.reduce((sum, r) => sum + r.totalRequests, 0);
  const todayTokens = dailyRows.reduce((sum, r) => sum + r.totalTokens, 0);
  const monthTokens = monthlyRows.reduce((sum, r) => sum + r.totalTokens, 0);
  const trendData = aggregateDailyTotals(trendRows, trendRange === "today" ? "hour" : "day");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">仪表盘</h1>
        <p className="mt-1 text-sm text-muted-foreground">门户概览，汇总今日与本月关键指标。</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* AI Accept 2026-07-16 main v1 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Activity className="h-4 w-4" />
              今日请求
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayRequests.toLocaleString("zh-CN")}</div>
            <p className="mt-1 text-xs text-muted-foreground">次请求</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              本月请求
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthRequests.toLocaleString("zh-CN")}</div>
            <p className="mt-1 text-xs text-muted-foreground">次请求</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Coins className="h-4 w-4" />
              今日 Token
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayTokens.toLocaleString("zh-CN")}</div>
            <p className="mt-1 text-xs text-muted-foreground">输入 + 输出 Token</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Layers className="h-4 w-4" />
              本月 Token
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthTokens.toLocaleString("zh-CN")}</div>
            <p className="mt-1 text-xs text-muted-foreground">输入 + 输出 Token</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              今日费用
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUsd(todayCost)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {todayRequests.toLocaleString("zh-CN")} 次请求
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Wallet className="h-4 w-4" />
              本月费用
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUsd(monthCost)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {monthRequests.toLocaleString("zh-CN")} 次请求
            </p>
          </CardContent>
        </Card>

        <SummaryJobCard run={latestSummaryRun} />
        <PeriodJobCard run={latestPeriodRun} />
      </div>

      <div className="flex flex-col gap-4">
        <WeeklyCostBar rows={weeklyCostRows} />
        <WeeklyTrendChart data={trendData} range={trendRange} />
      </div>
    </div>
  );
}
