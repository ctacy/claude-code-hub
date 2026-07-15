// AI Accept 2026-07-14 main v1
"use client";

/**
 * 增长率徽章
 * delta: 百分比数值 (e.g. 38 = +38%); null 时显示 "—"
 * 颜色阈值：>+50% 强红 / +10%~50% 浅红 / -10%~+10% 灰 / <-10% 绿
 * 异常值 |delta| > 1000 时截断显示
 */
function formatDelta(delta: number): string {
  const abs = Math.abs(delta);
  if (abs > 1000) {
    return delta > 0 ? "> +1000%" : "< -1000%";
  }
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

function colorClass(delta: number): string {
  if (delta > 50) {
    return "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400";
  }
  if (delta > 10) {
    return "text-red-400 bg-red-50/60 dark:bg-red-950/20 dark:text-red-300";
  }
  if (delta >= -10) {
    return "text-muted-foreground bg-muted/50";
  }
  return "text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400";
}

export function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-xs text-muted-foreground/60">—</span>;
  }

  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "";
  const display = formatDelta(delta);

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium tabular-nums whitespace-nowrap ${colorClass(delta)}`}
    >
      {arrow && <span aria-hidden>{arrow}</span>}
      {display}
    </span>
  );
}
