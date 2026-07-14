// AI Accept 2026-07-14 main v1
"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Period = "daily" | "weekly" | "monthly" | "allTime" | "custom";

const QUICK_PERIODS: { value: Period; label: string }[] = [
  { value: "daily", label: "今日" },
  { value: "weekly", label: "本周" },
  { value: "monthly", label: "本月" },
  { value: "allTime", label: "全部" },
];

function formatDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function CostPeriodBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = (searchParams.get("period") as Period | null) ?? "daily";
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const today = formatDate(new Date());

  const selectedRange: DateRange | undefined =
    current === "custom" && startDate
      ? { from: parseDate(startDate), to: endDate ? parseDate(endDate) : parseDate(startDate) }
      : undefined;

  function applyQuick(period: Period) {
    const params = new URLSearchParams();
    params.set("period", period);
    router.push(`/portal/cost?${params}`);
  }

  function handleDateRangeSelect(range: DateRange | undefined) {
    if (!range?.from) return;
    const params = new URLSearchParams();
    params.set("period", "custom");
    params.set("startDate", formatDate(range.from));
    params.set("endDate", formatDate(range.to ?? range.from));
    router.push(`/portal/cost?${params}`);
    if (range.to) setCalendarOpen(false);
  }

  const customLabel =
    current === "custom" && startDate
      ? startDate === endDate
        ? startDate
        : `${startDate} 至 ${endDate}`
      : "自定义";

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {QUICK_PERIODS.map((p) => (
          <Button
            key={p.value}
            variant={current === p.value ? "default" : "ghost"}
            size="sm"
            onClick={() => applyQuick(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="h-6 w-px bg-border" />

      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={current === "custom" ? "default" : "outline"}
            size="sm"
            className={cn(
              "min-w-[160px] justify-start text-left font-normal",
              current !== "custom" && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span className="truncate">{customLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={selectedRange?.from}
            selected={selectedRange}
            onSelect={handleDateRangeSelect}
            numberOfMonths={2}
            disabled={{ after: parseDate(today) }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
