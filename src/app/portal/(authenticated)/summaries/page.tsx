import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  listAllUsersWithSummaryByDate,
  listLatestSummariesPerUser,
} from "@/repository/daily-work-summary";
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
    ? await listAllUsersWithSummaryByDate(date)
    : await listLatestSummariesPerUser();

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
            <div className="w-32 pl-3 shrink-0">用户</div>
            <div className="w-32 px-3 shrink-0">{dateValid ? "总结日期" : "最近总结日期"}</div>
            <div className="w-24 px-3 shrink-0">{dateValid ? "当日请求数" : "请求数"}</div>
            <div className="flex-1 px-3 pr-3">工作总结</div>
          </div>
          {rows.map((row) => {
            const hasData = row.requestCount !== null;
            return (
              <Link
                key={`${row.userName}-${row.date}`}
                href={
                  hasData
                    ? `/portal/summaries/${encodeURIComponent(row.userName)}/${row.date}`
                    : "#"
                }
                className={`group flex items-start min-h-11 text-sm border-b border-border/40 last:border-b-0 transition-colors ${
                  hasData ? "hover:bg-accent/50" : "pointer-events-none opacity-50"
                }`}
              >
                <div className="w-32 pl-3 py-2 shrink-0 truncate">{row.userName}</div>
                <div className="w-32 px-3 py-2 shrink-0 font-mono text-xs text-muted-foreground">
                  {row.date}
                </div>
                <div className="w-24 px-3 py-2 shrink-0 text-muted-foreground">
                  {hasData ? row.requestCount : "—"}
                </div>
                <div className="flex-1 px-3 pr-3 py-2 text-xs text-muted-foreground line-clamp-1 group-hover:line-clamp-none">
                  {hasData ? (row as any).summaryText : "当日无请求"}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
