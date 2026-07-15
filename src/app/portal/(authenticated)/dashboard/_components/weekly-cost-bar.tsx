// AI Accept 2026-07-15 main v2
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
    current: { label: "本周", color: "var(--chart-1)" },
    prior: { label: "上周", color: "var(--chart-2)" },
  };

  // 用户名较多时旋转 X 轴标签，留出高度
  const tickAngle = data.length > 8 ? -45 : 0;
  const xAxisHeight = data.length > 8 ? 64 : 32;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">本周暂无消耗数据</div>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
              <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: xAxisHeight }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                  angle={tickAngle}
                  textAnchor={tickAngle !== 0 ? "end" : "middle"}
                  tickFormatter={(v: string) => (v.length > 5 ? `${v.slice(0, 5)}…` : v)}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={52}
                  tickFormatter={(v: number) => `$${Number(v).toFixed(0)}`}
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
                <Bar dataKey="prior" fill="var(--color-prior)" radius={[3, 3, 0, 0]} barSize={12} />
                <Bar
                  dataKey="current"
                  fill="var(--color-current)"
                  radius={[3, 3, 0, 0]}
                  barSize={12}
                />
              </BarChart>
            </ChartContainer>
            <p className="mt-2 text-xs text-muted-foreground">
              共 {rows.length} 位用户 · 按环比绝对值降序
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
