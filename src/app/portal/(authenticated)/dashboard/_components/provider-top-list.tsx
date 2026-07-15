// AI Accept 2026-07-15 main v1
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProviderTopRow } from "@/lib/portal/dashboard-profile";

function formatUsd(v: number): string {
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

function formatPercent(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export function ProviderTopList({
  rows,
  title = "本周 Provider 消耗排行",
}: {
  rows: ProviderTopRow[];
  title?: string;
}) {
  const maxCost = rows.reduce((max, r) => (r.totalCost > max ? r.totalCost : max), 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            本周暂无 Provider 数据
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const widthPct = maxCost > 0 ? (row.totalCost / maxCost) * 100 : 0;
              return (
                <li key={row.providerId} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{row.providerName}</span>
                    <span className="font-mono">{formatUsd(row.totalCost)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary/80"
                      style={{ width: `${widthPct}%` }}
                      aria-hidden
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{row.totalRequests.toLocaleString("zh-CN")} 次请求</span>
                    <span className="flex gap-3">
                      <span>成功率 {formatPercent(row.successRate)}</span>
                      <span>TTFB {row.avgTtfbMs}ms</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
