// AI Accept 2026-07-14 main v2
"use client";

import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type PeriodType = "day" | "week" | "month" | "year";

type JobState = {
  status: "running" | "done" | "failed" | "not_found";
  jobId: string;
  periodType: string;
  periodStart: string;
  startedAt?: string;
  finishedAt?: string;
  result?: {
    dateStr: string;
    total: number;
    ok: number;
    failed: number;
    failureReason?: string;
    failedUsers?: Array<{ userName: string; reason: string }>;
  };
  error?: string;
};

function getPeriodBounds(
  type: PeriodType,
  refDate: Date
): { start: string; end: string; label: string } {
  let startDate: Date;
  let endDate: Date;
  let label: string;

  switch (type) {
    case "day":
      startDate = refDate;
      endDate = refDate;
      label = format(refDate, "yyyy-MM-dd");
      break;
    case "week": {
      startDate = startOfWeek(refDate, { weekStartsOn: 1 });
      endDate = endOfWeek(refDate, { weekStartsOn: 1 });
      label = `${format(startDate, "yyyy-MM-dd")} ~ ${format(endDate, "yyyy-MM-dd")}`;
      break;
    }
    case "month":
      startDate = startOfMonth(refDate);
      endDate = endOfMonth(refDate);
      label = format(refDate, "yyyy年MM月");
      break;
    case "year":
      startDate = startOfYear(refDate);
      endDate = endOfYear(refDate);
      label = format(refDate, "yyyy年");
      break;
  }

  return {
    start: format(startDate, "yyyy-MM-dd"),
    end: format(endDate, "yyyy-MM-dd"),
    label,
  };
}

function shiftPeriod(type: PeriodType, currentStart: string, direction: 1 | -1): string {
  const date = parseISO(currentStart);
  let newDate: Date;
  switch (type) {
    case "day":
      newDate = addDays(date, direction);
      break;
    case "week":
      newDate = addWeeks(date, direction);
      break;
    case "month":
      newDate = addMonths(date, direction);
      break;
    case "year":
      newDate = addYears(date, direction);
      break;
  }
  const bounds = getPeriodBounds(type, newDate);
  return bounds.start;
}

export function PeriodToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const periodParam = (searchParams.get("period") as PeriodType | null) ?? "day";
  const periodStartParam = searchParams.get("periodStart");

  const currentPeriod = ["day", "week", "month", "year"].includes(periodParam)
    ? periodParam
    : "day";
  const today = new Date();
  const defaultBounds = getPeriodBounds(currentPeriod as PeriodType, today);
  const currentPeriodStart = periodStartParam ?? defaultBounds.start;

  const bounds = getPeriodBounds(currentPeriod as PeriodType, parseISO(currentPeriodStart));

  const [job, setJob] = useState<JobState | null>(null);
  const [loading, setLoading] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    },
    []
  );

  function applyPeriod(type: PeriodType, start: string) {
    const params = new URLSearchParams();
    params.set("period", type);
    params.set("periodStart", start);
    router.push(`/portal/summaries?${params}`);
  }

  function handleTabClick(type: PeriodType) {
    const refDate = type === currentPeriod ? parseISO(currentPeriodStart) : today;
    const bounds = getPeriodBounds(type, refDate);
    applyPeriod(type, bounds.start);
  }

  function handleNav(direction: 1 | -1) {
    const newStart = shiftPeriod(currentPeriod as PeriodType, currentPeriodStart, direction);
    applyPeriod(currentPeriod as PeriodType, newStart);
  }

  function handleDateSelect(date: Date | undefined) {
    if (!date) return;
    const newBounds = getPeriodBounds(currentPeriod as PeriodType, date);
    applyPeriod(currentPeriod as PeriodType, newBounds.start);
    setCalendarOpen(false);
  }

  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  async function pollJob(jobId: string) {
    const pollUrl =
      currentPeriod === "day"
        ? `/api/portal/summaries/trigger?jobId=${encodeURIComponent(jobId)}`
        : `/api/portal/summaries/period-trigger?jobId=${encodeURIComponent(jobId)}`;
    try {
      const res = await fetch(pollUrl, { cache: "no-store" });
      const data = (await res.json()) as JobState;
      setJob(data);
      if (data.status === "done") {
        stopPolling();
        if (data.result && data.result.ok > 0) router.refresh();
      } else if (data.status === "failed") {
        stopPolling();
      }
    } catch (e) {
      setJob((prev) => ({
        jobId,
        status: "failed",
        periodType: prev?.periodType ?? "",
        periodStart: prev?.periodStart ?? "",
        error: `轮询异常：${e instanceof Error ? e.message : String(e)}`,
      }));
      stopPolling();
    }
  }

  async function triggerSummary() {
    setLoading(true);
    setJob(null);
    try {
      const res =
        currentPeriod === "day"
          ? await fetch("/api/portal/summaries/trigger", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date: currentPeriodStart }),
            })
          : await fetch("/api/portal/summaries/period-trigger", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ periodType: currentPeriod, periodStart: currentPeriodStart }),
            });
      const data = await res.json();
      if (!res.ok) {
        setJob({
          jobId: "",
          status: "failed",
          periodType: currentPeriod,
          periodStart: currentPeriodStart,
          error: data.error ?? res.statusText,
        });
        return;
      }
      const jobId = data.jobId as string;
      setJob({
        jobId,
        status: "running",
        periodType: currentPeriod,
        periodStart: currentPeriodStart,
      });
      stopPolling();
      pollTimerRef.current = setInterval(() => void pollJob(jobId), 3000);
      void pollJob(jobId);
    } catch (e) {
      setJob({
        jobId: "",
        status: "failed",
        periodType: currentPeriod,
        periodStart: currentPeriodStart,
        error: `请求异常：${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setLoading(false);
    }
  }

  const resultText = (() => {
    if (!job) return null;
    if (job.status === "running") return "汇总中…";
    if (job.status === "failed") return `失败：${job.error ?? "未知错误"}`;
    const r = job.result;
    if (!r) return null;
    let msg = `完成：${r.dateStr} 共 ${r.total} 用户，成功 ${r.ok}，失败 ${r.failed}`;
    if (r.failureReason) msg += `\n原因：${r.failureReason}`;
    if (r.failedUsers && r.failedUsers.length > 0) {
      msg += "\n失败用户：";
      for (const u of r.failedUsers) msg += `\n  - ${u.userName}: ${u.reason}`;
    }
    return msg;
  })();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {(["day", "week", "month", "year"] as const).map((type) => (
            <Button
              key={type}
              variant={currentPeriod === type ? "default" : "ghost"}
              size="sm"
              onClick={() => handleTabClick(type)}
            >
              {type === "day" && "今日"}
              {type === "week" && "本周"}
              {type === "month" && "本月"}
              {type === "year" && "本年"}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleNav(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="min-w-48 justify-center font-normal text-muted-foreground"
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {bounds.label}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                defaultMonth={parseISO(currentPeriodStart)}
                selected={parseISO(currentPeriodStart)}
                onSelect={handleDateSelect}
                disabled={{ after: today }}
              />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" onClick={() => handleNav(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={triggerSummary}
          disabled={loading || job?.status === "running"}
        >
          <RefreshCw
            className={`h-4 w-4 mr-1.5 ${job?.status === "running" ? "animate-spin" : ""}`}
          />
          重新汇总
        </Button>
      </div>
      {resultText && (
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans">
          {resultText}
        </pre>
      )}
    </div>
  );
}
