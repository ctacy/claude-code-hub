// AI Accept 2026-07-14 main v1
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/date-format";
import { getPeriodSummary } from "@/repository/period-work-summary";
import { CopySummaryButton } from "../../../../_components/copy-summary-button";

export const dynamic = "force-dynamic";

const PERIOD_LABEL: Record<string, string> = {
  week: "周报",
  month: "月报",
  year: "年报",
};

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

export default async function PortalPeriodSummaryDetailPage({
  params,
}: {
  params: Promise<{ periodType: string; periodStart: string; userName: string }>;
}) {
  const { periodType, periodStart, userName: encodedUserName } = await params;
  const userName = decodeURIComponent(encodedUserName);
  if (!["week", "month", "year"].includes(periodType) || !userName || !periodStart) notFound();

  const summary = await getPeriodSummary(
    userName,
    periodType as "week" | "month" | "year",
    periodStart
  );
  if (!summary) notFound();

  const periodLabel = PERIOD_LABEL[periodType] ?? periodType;

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/portal/summaries?period=${periodType}&periodStart=${periodStart}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← 返回{periodLabel}列表
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {userName} · {periodLabel}
        </h1>
        <p className="text-sm text-muted-foreground">
          周期：{summary.periodStart} ~ {summary.periodEnd} · 覆盖 {summary.dayCount} 天 · 请求数{" "}
          {summary.requestCount}
        </p>
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
        <CardHeader className="flex items-center justify-between flex-row">
          <CardTitle className="text-base">工作总结</CardTitle>
          <CopySummaryButton text={summary.summaryText ?? ""} />
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {summary.summaryText ?? "（无内容）"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">生成元数据</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>
            生成于{" "}
            {summary.updatedAt
              ? formatDate(summary.updatedAt, "yyyy-MM-dd HH:mm:ss", "zh-CN")
              : "—"}
          </p>
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
