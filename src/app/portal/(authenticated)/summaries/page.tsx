import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { listSummaryUsers } from "@/repository/daily-work-summary";

export const dynamic = "force-dynamic";

export default async function PortalSummariesPage() {
  const users = await listSummaryUsers();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">按用户工作总结</h1>
        <p className="mt-1 text-sm text-muted-foreground">每日凌晨自动生成，按用户查看历史总结。</p>
      </div>

      {users.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            暂无总结数据。请确认 ENABLE_IO_BODY_LOGGING 已开启，且定时任务已运行过至少一次。
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <div className="bg-muted/30 border-b flex items-center h-9 text-xs font-medium text-muted-foreground/80">
            <div className="flex-1 pl-3">用户</div>
            <div className="w-40 px-3">最近总结日期</div>
            <div className="w-32 px-3">累计请求数</div>
          </div>
          {users
            .sort((a, b) => b.latestDate.localeCompare(a.latestDate))
            .map((u) => (
              <Link
                key={u.userName}
                href={`/portal/summaries/${encodeURIComponent(u.userName)}`}
                className="flex items-center h-11 text-sm border-b border-border/40 last:border-b-0 hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 pl-3 truncate">{u.userName}</div>
                <div className="w-40 px-3 font-mono text-xs text-muted-foreground">
                  {u.latestDate}
                </div>
                <div className="w-32 px-3 text-muted-foreground">{u.totalRequests}</div>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
