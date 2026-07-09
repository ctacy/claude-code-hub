import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/date-format";
import { getDailySummary } from "@/repository/daily-work-summary";

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

export default async function PortalSummaryDetailPage({
  params,
}: {
  params: Promise<{ userName: string; date: string }>;
}) {
  const { userName: encodedUserName, date } = await params;
  const userName = decodeURIComponent(encodedUserName);
  if (!userName || !date) notFound();

  const summary = await getDailySummary(userName, date);
  if (!summary) notFound();

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
    </div>
  );
}
