// AI Accept 2026-07-14 main v4
"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/repository/leaderboard";
import { DeltaBadge } from "./delta-badge";

type RowEntry = LeaderboardEntry & { weekOverWeekDelta?: number | null };

function formatCost(usd: number): string {
  if (usd === 0) return "$0.0000";
  if (usd < 0.0001) return `$${usd.toExponential(2)}`;
  return `$${usd.toFixed(4)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const TROPHY = ["🥇", "🥈", "🥉"];

type SortKey = "totalRequests" | "totalTokens" | "totalCost";
type SortDir = "asc" | "desc";
// null means use server-side default ordering (cost DESC)
type SortState = { key: SortKey; dir: SortDir } | null;

export function CostLeaderboardTable({
  rows,
  periodLabel,
  comparisonLabel,
}: {
  rows: RowEntry[];
  periodLabel: string;
  /** 增长率对比列的表头文案；不同周期对比基准不同（如"上周对比"/"上月对比"） */
  comparisonLabel?: string;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [sort, setSort] = useState<SortState>(null);

  function toggle(userId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function cycleSort(key: SortKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  }

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const diff = (a[sort.key] as number) - (b[sort.key] as number);
      return sort.dir === "asc" ? diff : -diff;
    });
    return copy;
  }, [rows, sort]);

  if (rows.length === 0) {
    return (
      <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
        {periodLabel}暂无消耗数据。
      </div>
    );
  }

  function SortHeader({ k, children }: { k: SortKey; children: React.ReactNode }) {
    const active = sort?.key === k;
    const dir = active ? sort?.dir : null;
    return (
      <button
        type="button"
        onClick={() => cycleSort(k)}
        className={cn(
          "inline-flex items-center gap-0.5 hover:text-foreground transition-colors text-right w-full justify-end",
          active && "text-foreground"
        )}
        title={active ? (dir === "asc" ? "升序" : "降序") : "点击按降序排序"}
      >
        {children}
        {active && dir === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : active && dir === "desc" ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <div className="bg-muted/30 border-b flex items-center h-9 text-xs font-medium text-muted-foreground/80">
        <div className="w-10 shrink-0" />
        <div className="w-10 pl-3 shrink-0 text-right">#</div>
        <div className="flex-1 px-3">用户</div>
        <div className="w-28 px-3 shrink-0 text-right">
          <SortHeader k="totalRequests">请求数</SortHeader>
        </div>
        <div className="w-28 px-3 shrink-0 text-right">
          <SortHeader k="totalTokens">Token 用量</SortHeader>
        </div>
        <div className="w-32 px-3 pr-4 shrink-0 text-right">
          <SortHeader k="totalCost">消耗金额</SortHeader>
        </div>
        {comparisonLabel && (
          <div className="w-24 px-3 pr-4 shrink-0 text-right">{comparisonLabel}</div>
        )}
      </div>
      {sortedRows.map((row, idx) => {
        const isOpen = expanded.has(row.userId);
        const modelStats = row.modelStats ?? [];
        const hasChildren = modelStats.length > 0;
        return (
          <div key={row.userId} className="border-b border-border/40 last:border-b-0">
            <button
              type="button"
              onClick={() => hasChildren && toggle(row.userId)}
              disabled={!hasChildren}
              className={cn(
                "flex w-full items-center h-10 text-sm text-left transition-colors",
                hasChildren ? "hover:bg-muted/30 cursor-pointer" : "cursor-default",
                isOpen && "bg-muted/20"
              )}
            >
              <div className="w-10 shrink-0 flex justify-center text-muted-foreground">
                {hasChildren ? (
                  <ChevronRight
                    className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")}
                  />
                ) : (
                  <span className="w-4" />
                )}
              </div>
              <div className="w-10 pl-3 shrink-0 text-right text-muted-foreground text-xs">
                <span className="inline-flex items-center gap-1">
                  {idx < 3 && <span aria-hidden>{TROPHY[idx]}</span>}#{idx + 1}
                </span>
              </div>
              <div className="flex-1 px-3 truncate">{row.userName}</div>
              <div className="w-28 px-3 shrink-0 text-right text-muted-foreground">
                {row.totalRequests.toLocaleString()}
              </div>
              <div className="w-28 px-3 shrink-0 text-right text-muted-foreground font-mono text-xs">
                {formatTokens(row.totalTokens)}
              </div>
              <div className="w-32 px-3 pr-4 shrink-0 text-right font-mono font-semibold">
                {formatCost(row.totalCost)}
              </div>
              {comparisonLabel && (
                <div className="w-24 px-3 pr-4 shrink-0 text-right">
                  <DeltaBadge delta={row.weekOverWeekDelta ?? null} />
                </div>
              )}
            </button>
            {hasChildren && isOpen && (
              <div className="bg-muted/10 border-t border-border/40">
                {modelStats.map((m, mIdx) => (
                  <div
                    key={`${row.userId}-${m.model ?? "unknown"}-${mIdx}`}
                    className="flex items-center h-9 text-xs"
                  >
                    <div className="w-10 shrink-0" />
                    <div className="w-10 shrink-0" />
                    <div className="flex-1 px-3 pl-10 truncate font-mono text-muted-foreground">
                      {m.model ?? "(未知模型)"}
                    </div>
                    <div className="w-28 px-3 shrink-0 text-right text-muted-foreground">
                      {m.totalRequests.toLocaleString()}
                    </div>
                    <div className="w-28 px-3 shrink-0 text-right text-muted-foreground font-mono text-xs">
                      {formatTokens(m.totalTokens)}
                    </div>
                    <div className="w-32 px-3 pr-4 shrink-0 text-right font-mono">
                      {formatCost(m.totalCost)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
