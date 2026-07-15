// AI Accept 2026-07-15 main v1
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JobStatePayload } from "@/jobs/daily-work-summary-runner";
import type { PeriodJobStatePayload } from "@/jobs/period-work-summary-runner";
import {
  aggregateDailyTotals,
  getWeeklyCostProfile,
  getWeeklyProviderTop,
} from "@/lib/portal/dashboard-profile";
import { getLatestPortalJob } from "@/lib/portal/jobs-status";
import { findDailyLeaderboard, findMonthlyLeaderboard } from "@/repository/leaderboard";
import { getUserStatisticsFromDB } from "@/repository/statistics";
import { ProviderTopList } from "./_components/provider-top-list";
import { WeeklyCostBar } from "./_components/weekly-cost-bar";
import { WeeklyTrendChart } from "./_components/weekly-trend-chart";

export const dynamic = "force-dynamic";

function formatUsd(amount: number): string {
  return `$${amount.toFixed(4)}`;
}

const JOB_STATUS_LABEL: Record<string, string> = {
  running: "运行中",
  done: "完成",
  failed: "失败",
};

const JOB_STATUS_CLASS: Record<string, string> = {
  running: "text-blue-500",
  done: "text-green-600",
  failed: "text-red-500",
};

function SummaryJobCard({ job }: { job: JobStatePayload | null }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">日报汇总任务</CardTitle>
      </CardHeader>
      <CardContent>
        {job ? (
          <div>
            <div
              className={`text-base font-semibold ${JOB_STATUS_CLASS[job.status] ?? "text-foreground"}`}
            >
              {JOB_STATUS_LABEL[job.status] ?? job.status}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {job.date ? `${job.date}` : ""}
              {job.finishedAt
                ? ` · 完成于 ${new Date(job.finishedAt).toLocaleString("zh-CN")}`
                : job.startedAt
                  ? ` · 启动于 ${new Date(job.startedAt).toLocaleString("zh-CN")}`
                  : ""}
            </p>
            {job.result && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {`成功 ${job.result.ok} / 共 ${job.result.total}`}
              </p>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">暂无记录</div>
        )}
      </CardContent>
    </Card>
  );
}

function PeriodJobCard({ job }: { job: PeriodJobStatePayload | null }) {
  const PERIOD_LABEL: Record<string, string> = { week: "周", month: "月", year: "年" };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">周期汇总任务</CardTitle>
      </CardHeader>
      <CardContent>
        {job ? (
          <div>
            <div
              className={`text-base font-semibold ${JOB_STATUS_CLASS[job.status] ?? "text-foreground"}`}
            >
              {JOB_STATUS_LABEL[job.status] ?? job.status}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {`${PERIOD_LABEL[job.periodType] ?? job.periodType} · ${job.periodStart}`}
              {job.finishedAt
                ? ` · 完成于 ${new Date(job.finishedAt).toLocaleString("zh-CN")}`
                : job.startedAt
                  ? ` · 启动于 ${new Date(job.startedAt).toLocaleString("zh-CN")}`
                  : ""}
            </p>
            {job.result && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {`成功 ${job.result.ok} / 共 ${job.result.total}`}
              </p>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">暂无记录</div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function PortalDashboardPage() {
  const [
    dailyRows,
    monthlyRows,
    latestSummaryJob,
    latestPeriodJob,
    weeklyCostRows,
    weeklyTrendRows,
    weeklyProviderRows,
  ] = await Promise.all([
    findDailyLeaderboard(),
    findMonthlyLeaderboard(),
    getLatestPortalJob("summary"),
    getLatestPortalJob("period-summary"),
    getWeeklyCostProfile(),
    getUserStatisticsFromDB("7days"),
    getWeeklyProviderTop(),
  ]);

  const todayCost = dailyRows.reduce((sum, r) => sum + r.totalCost, 0);
  const todayRequests = dailyRows.reduce((sum, r) => sum + r.totalRequests, 0);
  const monthCost = monthlyRows.reduce((sum, r) => sum + r.totalCost, 0);
  const trendData = aggregateDailyTotals(weeklyTrendRows);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">仪表盘</h1>
        <p className="mt-1 text-sm text-muted-foreground">门户概览，汇总今日与本月关键指标。</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">今日费用</CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">本月费用</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUsd(monthCost)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {monthlyRows.reduce((s, r) => s + r.totalRequests, 0).toLocaleString("zh-CN")} 次请求
            </p>
          </CardContent>
        </Card>

        <SummaryJobCard job={latestSummaryJob} />
        <PeriodJobCard job={latestPeriodJob} />
      </div>

      <div className="flex flex-col gap-4">
        <WeeklyCostBar rows={weeklyCostRows} />
        <WeeklyTrendChart data={trendData} />
      </div>

      <div>
        <ProviderTopList rows={weeklyProviderRows} />
      </div>
    </div>
  );
}
