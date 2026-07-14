// AI Accept 2026-07-14 main v1
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

type PeriodType = "week" | "month" | "year";

const PERIOD_LABEL: Record<PeriodType, string> = {
  week: "周",
  month: "月",
  year: "年",
};

function formatDelta(delta: number | null): { text: string; colorClass: string } {
  if (delta === null) {
    return { text: "—", colorClass: "text-muted-foreground" };
  }
  const display =
    delta > 1000
      ? "> +1000%"
      : delta < -1000
        ? "< -1000%"
        : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
  const colorClass =
    delta > 50
      ? "text-red-600 dark:text-red-400"
      : delta > 10
        ? "text-red-400 dark:text-red-300"
        : delta >= -10
          ? "text-muted-foreground"
          : "text-green-600 dark:text-green-400";
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "";
  return { text: arrow ? `${arrow} ${display}` : display, colorClass };
}

/**
 * 周期汇总页顶部的"对比上一周期"卡片。
 * 仅在 week/month/year 视图下渲染，点击可跳转至上一周期。
 */
export function PeriodComparisonCard({
  periodType,
  currentTotal,
  priorTotal,
  delta,
  priorPeriodStart,
}: {
  periodType: PeriodType;
  currentTotal: number;
  priorTotal: number;
  delta: number | null;
  priorPeriodStart: string;
}) {
  const { text, colorClass } = formatDelta(delta);
  const label = PERIOD_LABEL[periodType];

  return (
    <Link
      href={`/portal/summaries?period=${periodType}&periodStart=${priorPeriodStart}`}
      className="block"
    >
      <Card className="transition-colors hover:bg-accent/50">
        <CardContent className="flex items-center justify-between gap-4 py-3">
          <div className="text-sm text-muted-foreground">
            对比上一{label}期：本{label} {currentTotal.toLocaleString()} 请求 · 上{label}{" "}
            {priorTotal.toLocaleString()} 请求
          </div>
          <div className={`text-sm font-semibold ${colorClass}`}>{text}</div>
        </CardContent>
      </Card>
    </Link>
  );
}
