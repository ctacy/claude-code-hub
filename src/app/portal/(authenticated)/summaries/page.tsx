import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { listDailySummariesByDate, listSummaryUsers } from "@/repository/daily-work-summary";
import { SummariesToolbar } from "./_components/summaries-toolbar";

export const dynamic = "force-dynamic";

export default async function PortalSummariesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const dateValid = date && /^\d{4}-\d{2}-\d{2}$/.test(date);

  const rows = dateValid
    ? (await listDailySummariesByDate(date)).map((r) => ({
        userName: r.userName,
        date: r.date,
        requestCount: r.requestCount,
      }))
    : (await listSummaryUsers()).map((u) => ({
        userName: u.userName,
        date: u.latestDate,
        requestCount: u.totalRequests,
      }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">按用户工作总结</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {dateValid
            ? `展示 ${date} 当天所有用户的总结。`
            : "每日凌晨自动生成，可按日期筛选或手动重新汇总。"}
        </p>
      </div>

      <SummariesToolbar date={dateValid ? date : undefined} />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {dateValid
              ? `${date} 暂无总结数据，可点击「重新汇总」立即生成。`
              : "暂无总结数据。请确认 ENABLE_IO_BODY_LOGGING 已开启，且定时任务已运行过至少一次。"}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <div className="bg-muted/30 border-b flex items-center h-9 text-xs font-medium text-muted-foreground/80">
            <div className="flex-1 pl-3">用户</div>
            <div className="w-40 px-3">{dateValid ? "总结日期" : "最近总结日期"}</div>
            <div className="w-32 px-3">{dateValid ? "当日请求数" : "累计请求数"}</div>
          </div>
          {rows.map((u) => (
            <Link
              key={`${u.userName}-${u.date}`}
              href={`/portal/summaries/${encodeURIComponent(u.userName)}/${u.date}`}
              className="flex items-center h-11 text-sm border-b border-border/40 last:border-b-0 hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 pl-3 truncate">{u.userName}</div>
              <div className="w-40 px-3 font-mono text-xs text-muted-foreground">{u.date}</div>
              <div className="w-32 px-3 text-muted-foreground">{u.requestCount}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
