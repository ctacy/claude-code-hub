// AI Accept 2026-07-15 main v1
"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { WeeklyCostRow } from "@/lib/portal/dashboard-profile";

function formatUsd(v: number): string {
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

function formatDelta(d: number | null): string {
  if (d === null) return "新增";
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(1)}%`;
}

interface ChartDatum {
  name: string;
  current: number;
  prior: number;
}

export function WeeklyCostBar({
  rows,
  title = "本周 vs 上周用户消耗对比",
}: {
  rows: WeeklyCostRow[];
  title?: string;
}) {
  const data: ChartDatum[] = rows.map((r) => ({
    name: r.userName,
    current: r.currentCost,
    prior: r.priorCost,
  }));

  const chartConfig = {
    current: { label: "本周", color: "hsl(var(--chart-1))" },
    prior: { label: "上周", color: "hsl(var(--chart-2))" },
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">本周暂无消耗数据</div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full">
            <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={0}
                tickFormatter={(v: string) => (v.length > 6 ? `${v.slice(0, 6)}…` : v)}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v: number) => `$${Number(v).toFixed(0)}`}
                width={48}
              />
              <ChartTooltip
                cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.4 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const datum = rows.find((r) => r.userName === label);
                  if (!datum) return null;
                  return (
                    <div className="border-border/50 bg-background rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
                      <div className="font-medium mb-1">{datum.userName}</div>
                      <div className="grid grid-cols-2 gap-x-3">
                        <span className="text-muted-foreground">本周</span>
                        <span className="font-mono tabular-nums text-right">
                          {formatUsd(datum.currentCost)}
                        </span>
                        <span className="text-muted-foreground">上周</span>
                        <span className="font-mono tabular-nums text-right">
                          {formatUsd(datum.priorCost)}
                        </span>
                        <span className="text-muted-foreground">环比</span>
                        <span
                          className={
                            datum.deltaPct === null
                              ? "font-mono tabular-nums text-right text-blue-500"
                              : datum.deltaPct > 0
                                ? "font-mono tabular-nums text-right text-red-500"
                                : "font-mono tabular-nums text-right text-green-600"
                          }
                        >
                          {formatDelta(datum.deltaPct)}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="prior" fill="var(--color-prior)" radius={[3, 3, 0, 0]} barSize={14} />
              <Bar
                dataKey="current"
                fill="var(--color-current)"
                radius={[3, 3, 0, 0]}
                barSize={14}
              />
            </BarChart>
          </ChartContainer>
        )}
        {rows.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            {rows.map((r) => (
              <div key={r.userId} className="flex items-center justify-between gap-2">
                <span className="truncate text-muted-foreground">{r.userName}</span>
                <span
                  className={
                    r.deltaPct === null
                      ? "font-mono text-blue-500"
                      : r.deltaPct > 0
                        ? "font-mono text-red-500"
                        : r.deltaPct < 0
                          ? "font-mono text-green-600"
                          : "font-mono text-muted-foreground"
                  }
                >
                  {formatDelta(r.deltaPct)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
