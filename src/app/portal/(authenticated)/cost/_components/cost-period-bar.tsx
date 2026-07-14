// AI Accept 2026-07-14 main v2
"use client";

import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Period = "daily" | "weekly" | "monthly" | "allTime" | "custom";
type QuickPeriod = "daily" | "weekly" | "monthly" | "allTime";

const QUICK_PERIODS: { value: QuickPeriod; label: string }[] = [
  { value: "daily", label: "今日" },
  { value: "weekly", label: "本周" },
  { value: "monthly", label: "本月" },
  { value: "allTime", label: "全部" },
];

function formatDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function parseDate(dateStr: string): Date {
  // 按本地日期解析，避免 new Date("YYYY-MM-DD") 走 UTC 导致跨时区偏移一天
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getDateRangeForPeriod(
  period: QuickPeriod,
  now: Date = new Date()
): { startDate: string; endDate: string } {
  switch (period) {
    case "daily":
      return { startDate: formatDate(now), endDate: formatDate(now) };
    case "weekly": {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = endOfWeek(now, { weekStartsOn: 1 });
      return { startDate: formatDate(start), endDate: formatDate(end) };
    }
    case "monthly": {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      return { startDate: formatDate(start), endDate: formatDate(end) };
    }
    default:
      return { startDate: "2020-01-01", endDate: formatDate(now) };
  }
}

function shiftDateRange(
  range: { startDate: string; endDate: string },
  direction: "prev" | "next"
): { startDate: string; endDate: string } {
  const start = parseDate(range.startDate);
  const end = parseDate(range.endDate);

  if (isSameDay(start, startOfMonth(start)) && isSameDay(end, endOfMonth(start))) {
    const month = addMonths(start, direction === "prev" ? -1 : 1);
    return {
      startDate: formatDate(startOfMonth(month)),
      endDate: formatDate(endOfMonth(month)),
    };
  }

  const days = differenceInCalendarDays(end, start) + 1;
  const shift = direction === "prev" ? -days : days;

  return {
    startDate: formatDate(addDays(start, shift)),
    endDate: formatDate(addDays(end, shift)),
  };
}

export function CostPeriodBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const period = (searchParams.get("period") as Period | null) ?? "daily";
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const today = formatDate(new Date());

  const currentRange = useMemo(() => {
    if (period === "custom" && startDateParam) {
      return { startDate: startDateParam, endDate: endDateParam ?? startDateParam };
    }
    if (period !== "custom") {
      return getDateRangeForPeriod(period as QuickPeriod);
    }
    return getDateRangeForPeriod("daily");
  }, [period, startDateParam, endDateParam]);

  const selectedRange: DateRange = {
    from: parseDate(currentRange.startDate),
    to: parseDate(currentRange.endDate),
  };

  function applyRange(newPeriod: Period, range?: { startDate: string; endDate: string }) {
    const params = new URLSearchParams();
    params.set("period", newPeriod);
    if (newPeriod === "custom" && range) {
      params.set("startDate", range.startDate);
      params.set("endDate", range.endDate);
    }
    router.push(`/portal/cost?${params}`);
  }

  function handleQuickClick(qp: QuickPeriod) {
    applyRange(qp);
  }

  function handleNavigate(direction: "prev" | "next") {
    const newRange = shiftDateRange(currentRange, direction);
    applyRange("custom", newRange);
  }

  function handleDateRangeSelect(range: DateRange | undefined) {
    if (!range?.from) return;
    const newRange = {
      startDate: formatDate(range.from),
      endDate: formatDate(range.to ?? range.from),
    };
    applyRange("custom", newRange);
    if (range.to) setCalendarOpen(false);
  }

  const displayLabel =
    period === "allTime"
      ? "全部"
      : currentRange.startDate === currentRange.endDate
        ? currentRange.startDate
        : `${currentRange.startDate} 至 ${currentRange.endDate}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        {QUICK_PERIODS.map((p) => (
          <Button
            key={p.value}
            variant={period === p.value ? "default" : "outline"}
            size="sm"
            onClick={() => handleQuickClick(p.value)}
            className="h-8"
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="h-6 w-px bg-border mx-1" />

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => handleNavigate("prev")}
          disabled={period === "allTime"}
          title="上一周期"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={period === "custom" ? "default" : "outline"}
              size="sm"
              className={cn(
                "min-w-[200px] justify-start text-left font-normal h-8",
                period !== "custom" && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              <span className="truncate">{displayLabel}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              defaultMonth={selectedRange.from}
              selected={selectedRange}
              onSelect={handleDateRangeSelect}
              numberOfMonths={2}
              disabled={{ after: parseDate(today) }}
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => handleNavigate("next")}
          disabled={period === "allTime" || currentRange.endDate >= today}
          title="下一周期"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
