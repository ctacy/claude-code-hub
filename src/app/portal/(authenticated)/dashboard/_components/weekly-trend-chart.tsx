// AI Accept 2026-07-15 main v1
"use client";

import { format, parseISO } from "date-fns";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { DailyTrendResult } from "@/lib/portal/dashboard-profile";

function formatUsd(v: number): string {
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

export function WeeklyTrendChart({
  data,
  title = "近 7 日每日费用走势",
}: {
  data: DailyTrendResult;
  title?: string;
}) {
  const chartData = data.series.map((p) => ({ date: p.date, cost: p.totalCost }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.series.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">近 7 日暂无消耗数据</div>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">近 7 日总费用</div>
                <div className="text-xl font-bold font-mono">{formatUsd(data.totalCost)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">近 7 日总请求</div>
                <div className="text-xl font-bold font-mono">
                  {data.totalRequests.toLocaleString("zh-CN")}
                </div>
              </div>
            </div>
            <ChartContainer
              config={{
                cost: { label: "费用", color: "var(--chart-1)" },
              }}
              className="aspect-auto h-[180px] w-full"
            >
              <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="weeklyTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-cost)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-cost)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tickFormatter={(v: string) => {
                    try {
                      return format(parseISO(v), "MM-dd");
                    } catch {
                      return v;
                    }
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={48}
                  tickFormatter={(v: number) => `$${Number(v).toFixed(0)}`}
                />
                <ChartTooltip
                  cursor={false}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const datum = data.series.find((p) => p.date === label);
                    if (!datum) return null;
                    return (
                      <div className="border-border/50 bg-background rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
                        <div className="font-medium mb-1">
                          {(() => {
                            try {
                              return format(parseISO(datum.date), "yyyy-MM-dd");
                            } catch {
                              return datum.date;
                            }
                          })()}
                        </div>
                        <div className="grid grid-cols-2 gap-x-3">
                          <span className="text-muted-foreground">费用</span>
                          <span className="font-mono tabular-nums text-right">
                            {formatUsd(datum.totalCost)}
                          </span>
                          <span className="text-muted-foreground">请求</span>
                          <span className="font-mono tabular-nums text-right">
                            {datum.totalRequests.toLocaleString("zh-CN")}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  dataKey="cost"
                  type="monotone"
                  fill="url(#weeklyTrendFill)"
                  stroke="var(--color-cost)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}
