// AI Accept 2026-07-14 main v1
"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { BatchActionsBar } from "./batch-actions-bar";
import { CopySummaryButton } from "./copy-summary-button";
import { SummaryCell } from "./summary-cell";

export interface SummaryRow {
  userName: string;
  date?: string;
  periodStart?: string;
  periodEnd?: string;
  requestCount: number | null;
  dayCount?: number;
  summaryText?: string;
}

interface SummaryTableClientProps {
  rows: SummaryRow[];
  showDate: boolean;
  showPeriod: boolean;
  currentPeriod: string;
  /** used for batch trigger; the date all rows share in day mode */
  effectiveDate?: string;
  dateValid: boolean;
}

// AI Accept 2026-07-14 main v2
export function SummaryTableClient({
  rows,
  showDate,
  showPeriod,
  currentPeriod,
  effectiveDate,
  dateValid,
}: SummaryTableClientProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const isAllSelected = rows.length > 0 && rows.every((r) => selected.has(r.userName));
  const isIndeterminate = selected.size > 0 && !isAllSelected;

  const toggleAll = useCallback(() => {
    if (isAllSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.userName)));
    }
  }, [isAllSelected, rows]);

  const toggleOne = useCallback((userName: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userName)) {
        next.delete(userName);
      } else {
        next.add(userName);
      }
      return next;
    });
  }, []);

  const selectedItems = Array.from(selected).map((userName) => ({
    userName,
    date: effectiveDate ?? "",
  }));

  const rowClass = "flex items-start min-h-11 text-sm border-b border-border/40 last:border-b-0";

  return (
    <div className="space-y-2">
      {showDate && selected.size > 0 && (
        <BatchActionsBar
          selectedCount={selected.size}
          selectedItems={selectedItems}
          periodStart={effectiveDate ?? ""}
          onClear={() => setSelected(new Set())}
        />
      )}
      <div className="rounded-md border">
        <div className="bg-muted/30 border-b flex items-center h-9 text-xs font-medium text-muted-foreground/80">
          {showDate && (
            <div className="w-10 pl-3 shrink-0 flex items-center">
              <Checkbox
                checked={isAllSelected}
                data-indeterminate={isIndeterminate}
                onCheckedChange={toggleAll}
                aria-label="全选"
              />
            </div>
          )}
          <div className="w-32 pl-3 shrink-0">用户</div>
          {showDate && (
            <>
              <div className="w-32 px-3 shrink-0">{dateValid ? "总结日期" : "最近总结日期"}</div>
              <div className="w-24 px-3 shrink-0">{dateValid ? "当日请求数" : "请求数"}</div>
            </>
          )}
          {showPeriod && (
            <>
              <div className="w-48 px-3 shrink-0">周期</div>
              <div className="w-24 px-3 shrink-0">天数</div>
              <div className="w-24 px-3 shrink-0">请求数</div>
            </>
          )}
          <div className="flex-1 px-3">工作总结</div>
          <div className="w-10 shrink-0" />
        </div>

        {rows.map((row) => {
          const hasData = row.requestCount !== null;
          const isChecked = selected.has(row.userName);

          const inner = (
            <>
              <div className="w-32 pl-3 py-2 shrink-0 truncate">{row.userName}</div>
              {showDate && (
                <>
                  <div className="w-32 px-3 py-2 shrink-0 font-mono text-xs text-muted-foreground">
                    {row.date}
                  </div>
                  <div className="w-24 px-3 py-2 shrink-0 text-muted-foreground">
                    {hasData ? row.requestCount : "—"}
                  </div>
                </>
              )}
              {showPeriod && (
                <>
                  <div className="w-48 px-3 py-2 shrink-0 font-mono text-xs text-muted-foreground">
                    {row.periodStart} ~ {row.periodEnd}
                  </div>
                  <div className="w-24 px-3 py-2 shrink-0 text-muted-foreground">
                    {row.dayCount ?? "—"}
                  </div>
                  <div className="w-24 px-3 py-2 shrink-0 text-muted-foreground">
                    {hasData ? row.requestCount : "—"}
                  </div>
                </>
              )}
              <div className="flex-1 min-w-0 px-3 py-2 text-xs text-muted-foreground">
                {hasData && row.summaryText ? (
                  <SummaryCell text={row.summaryText} />
                ) : showDate ? (
                  "当日无请求"
                ) : (
                  "暂无数据"
                )}
              </div>
            </>
          );

          const copyCell = (
            <div className="w-10 shrink-0 py-2 flex justify-center">
              {hasData && row.summaryText && <CopySummaryButton text={row.summaryText} />}
            </div>
          );

          if (showPeriod) {
            const linkHref =
              hasData && row.periodStart
                ? `/portal/summaries/period/${currentPeriod}/${row.periodStart}/${encodeURIComponent(row.userName)}`
                : "#";
            return (
              <div
                key={`${row.userName}-${row.periodStart ?? ""}`}
                className={`${rowClass} transition-colors ${hasData && row.periodStart ? "hover:bg-accent/50" : ""}`}
              >
                <Link
                  href={linkHref}
                  className={`flex flex-1 items-start ${
                    hasData && row.periodStart ? "" : "pointer-events-none"
                  }`}
                >
                  {inner}
                </Link>
                {copyCell}
              </div>
            );
          }

          const linkHref =
            hasData && row.date
              ? `/portal/summaries/${encodeURIComponent(row.userName)}/${row.date}`
              : "#";

          return (
            <div
              key={`${row.userName}-${row.date ?? ""}`}
              className={`${rowClass} transition-colors ${isChecked ? "bg-accent/30" : hasData && row.date ? "hover:bg-accent/50" : ""}`}
            >
              <div className="w-10 pl-3 shrink-0 flex items-center py-3">
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => toggleOne(row.userName)}
                  aria-label={`选择 ${row.userName}`}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <Link
                href={linkHref}
                className={`flex flex-1 items-start ${
                  hasData && row.date ? "" : "pointer-events-none"
                }`}
              >
                {inner}
              </Link>
              {copyCell}
            </div>
          );
        })}
      </div>
    </div>
  );
}
