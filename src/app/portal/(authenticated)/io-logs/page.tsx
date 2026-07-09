import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date-format";
import { listIoLogs } from "@/repository/io-log-query";

export const dynamic = "force-dynamic";

function statusVariant(code: number | null): "default" | "destructive" | "outline" | "secondary" {
  if (!code) return "outline";
  if (code >= 200 && code < 300) return "default";
  if (code >= 400) return "destructive";
  return "secondary";
}

function truncate(str: string | null, max = 120): string {
  if (!str) return "—";
  return str.length <= max ? str : `${str.slice(0, max)}…`;
}

export default async function PortalIoLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ keyword?: string; userName?: string }>;
}) {
  const { keyword, userName } = await searchParams;

  const result = await listIoLogs({
    limit: 100,
    keyword: keyword || null,
    userName: userName || null,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">请求记录</h1>
        <p className="mt-1 text-sm text-muted-foreground">最近 100 条请求日志（只读）。</p>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input
          type="text"
          name="userName"
          defaultValue={userName ?? ""}
          placeholder="按用户名筛选"
          className="h-9 w-48 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          type="text"
          name="keyword"
          defaultValue={keyword ?? ""}
          placeholder="关键字搜索"
          className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm"
        />
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground"
        >
          查询
        </button>
      </form>

      <div className="rounded-md border">
        <div className="bg-muted/30 border-b flex items-center h-9 text-xs font-medium text-muted-foreground/80">
          <div className="w-40 pl-3">时间</div>
          <div className="w-32 px-2">用户</div>
          <div className="w-28 px-2">模型</div>
          <div className="w-16 px-2">状态</div>
          <div className="flex-1 px-2 pr-3">请求预览</div>
        </div>
        {result.items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">暂无记录</div>
        ) : (
          result.items.map((log) => (
            <div
              key={log.id}
              className="flex items-center h-11 text-sm border-b border-border/40 last:border-b-0"
            >
              <div className="w-40 pl-3 font-mono text-xs truncate">
                {formatDate(log.createdAt, "yyyy-MM-dd HH:mm:ss", "zh-CN")}
              </div>
              <div className="w-32 px-2 truncate">{log.userName ?? "—"}</div>
              <div className="w-28 px-2 truncate">{log.originalModel ?? log.model ?? "—"}</div>
              <div className="w-16 px-2">
                {log.statusCode ? (
                  <Badge variant={statusVariant(log.statusCode)} className="text-[10px]">
                    {log.statusCode}
                  </Badge>
                ) : (
                  "—"
                )}
              </div>
              <div className="flex-1 px-2 pr-3 font-mono text-xs text-muted-foreground truncate">
                {truncate(log.requestBody)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
