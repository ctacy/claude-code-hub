// AI Accept 2026-07-14 main v1
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/date-format";
import { resolveSystemTimezone } from "@/lib/utils/timezone";
import { getDailySummary } from "@/repository/daily-work-summary";
import { type IoLogWithFlags, listIoLogsWithFlags } from "@/repository/io-log-audit";

export const dynamic = "force-dynamic";

const TAG_LABELS: Array<{ key: keyof ReturnType<typeof pickTags>; label: string }> = [
  { key: "tagsDebugging", label: "调试" },
  { key: "tagsDocumentation", label: "文档" },
  { key: "tagsCodeGen", label: "代码生成" },
  { key: "tagsRefactor", label: "重构" },
  { key: "tagsTesting", label: "测试" },
  { key: "tagsOther", label: "其他" },
];

function pickTags(row: {
  tagsDebugging: number;
  tagsDocumentation: number;
  tagsCodeGen: number;
  tagsRefactor: number;
  tagsTesting: number;
  tagsOther: number;
}) {
  return row;
}

/** 根据标记类型返回行样式 class */
function flagRowClass(log: IoLogWithFlags): string {
  if (log.flagBlast) return "border-l-4 border-l-red-500 bg-red-50/60 dark:bg-red-950/30";
  if (log.flagHuge) return "border-l-4 border-l-orange-500 bg-orange-50/60 dark:bg-orange-950/30";
  if (log.flagEmpty) return "border-l-4 border-l-yellow-500 bg-yellow-50/60 dark:bg-yellow-950/30";
  return "";
}

export default async function PortalSummaryDetailPage({
  params,
}: {
  params: Promise<{ userName: string; date: string }>;
}) {
  const { userName: encodedUserName, date } = await params;
  const userName = decodeURIComponent(encodedUserName);
  if (!userName || !date) notFound();

  const [summary, timezone] = await Promise.all([
    getDailySummary(userName, date),
    resolveSystemTimezone(),
  ]);
  if (!summary) notFound();

  const ioLogs = await listIoLogsWithFlags(userName, date, timezone).catch(
    (): IoLogWithFlags[] => []
  );

  const flaggedCount = ioLogs.filter((l) => l.flagBlast || l.flagEmpty || l.flagHuge).length;

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/portal/summaries/${encodeURIComponent(userName)}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← 返回 {userName} 的总结列表
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {userName} · {date}
        </h1>
        <p className="text-sm text-muted-foreground">当日请求数：{summary.requestCount}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">工作类型分类</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {TAG_LABELS.map(({ key, label }) => (
            <Badge key={key} variant="secondary">
              {label} {summary[key]} 次
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">工作总结</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{summary.summaryText}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">生成元数据</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>生成于 {formatDate(summary.generatedAt, "yyyy-MM-dd HH:mm:ss", "zh-CN")}</p>
          <p>
            Provider ID：{summary.providerId ?? "—"} · 模型：{summary.model ?? "—"}
          </p>
          <p>
            输入 {summary.inputTokens ?? 0} tokens · 输出 {summary.outputTokens ?? 0} tokens
          </p>
        </CardContent>
      </Card>

      {ioLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              IO 请求明细
              {flaggedCount > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  （
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    {flaggedCount} 条异常
                  </span>
                  ，共 {ioLogs.length} 条）
                </span>
              )}
              {flaggedCount === 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  共 {ioLogs.length} 条
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-sm bg-red-400" />
                重复 prompt
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-sm bg-yellow-400" />
                空输出
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-sm bg-orange-400" />
                巨大输入
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-b-lg overflow-hidden">
              <div className="bg-muted/30 border-y flex items-center h-7 text-[10px] font-medium text-muted-foreground/80 px-3">
                <div className="w-16 shrink-0">时间</div>
                <div className="w-20 shrink-0">标记</div>
                <div className="flex-1 min-w-0">请求内容</div>
                <div className="w-48 shrink-0 pl-2">响应内容</div>
              </div>
              {ioLogs.map((log) => {
                const hasFlag = log.flagBlast || log.flagEmpty || log.flagHuge;
                const timeStr = log.createdAt.toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                });
                return (
                  <div
                    key={log.id}
                    className={`flex items-start border-b border-border/30 last:border-b-0 px-3 py-1.5 text-xs ${flagRowClass(log)}`}
                  >
                    <div className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground pt-0.5">
                      {timeStr}
                    </div>
                    <div className="w-20 shrink-0 flex flex-wrap gap-0.5 pt-0.5">
                      {!hasFlag && <span className="text-[10px] text-muted-foreground/40">—</span>}
                      {log.flagBlast && (
                        <span className="inline-flex items-center rounded px-1 py-0 text-[9px] font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                          重复
                        </span>
                      )}
                      {log.flagEmpty && (
                        <span className="inline-flex items-center rounded px-1 py-0 text-[9px] font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400">
                          空输出
                        </span>
                      )}
                      {log.flagHuge && (
                        <span className="inline-flex items-center rounded px-1 py-0 text-[9px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
                          巨输入
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-[10px] text-foreground/80 truncate pr-2">
                      {log.requestBody?.slice(0, 120) ?? "(empty)"}
                    </div>
                    <div className="w-48 shrink-0 text-[10px] text-muted-foreground truncate">
                      {log.responseBody?.slice(0, 80) ?? "(empty)"}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
