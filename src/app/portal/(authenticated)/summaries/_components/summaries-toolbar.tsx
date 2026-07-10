"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type JobState = {
  status: "running" | "done" | "failed" | "not_found";
  jobId: string;
  date: string;
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

export function SummariesToolbar({ date }: { date?: string }) {
  const router = useRouter();
  const [dateInput, setDateInput] = useState(date ?? "");
  const [job, setJob] = useState<JobState | null>(null);
  const [loading, setLoading] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    },
    []
  );

  function applyDate(value: string) {
    const params = new URLSearchParams();
    if (value) params.set("date", value);
    router.push(`/portal/summaries${value ? `?${params}` : ""}`);
  }

  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  async function pollJob(jobId: string) {
    try {
      const res = await fetch(`/api/portal/summaries/trigger?jobId=${encodeURIComponent(jobId)}`, {
        cache: "no-store",
      });
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
        date: prev?.date ?? "",
        error: `轮询异常：${e instanceof Error ? e.message : String(e)}`,
      }));
      stopPolling();
    }
  }

  async function triggerSummary() {
    setLoading(true);
    setJob(null);
    try {
      const res = await fetch("/api/portal/summaries/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateInput || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJob({
          jobId: "",
          status: "failed",
          date: dateInput || "",
          error: data.error ?? res.statusText,
        });
        return;
      }
      const jobId = data.jobId as string;
      setJob({ jobId, status: "running", date: dateInput || "" });
      stopPolling();
      pollTimerRef.current = setInterval(() => void pollJob(jobId), 3000);
      // 立刻拉一次，不用等3秒
      void pollJob(jobId);
    } catch (e) {
      setJob({
        jobId: "",
        status: "failed",
        date: dateInput || "",
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
        <div className="flex flex-col gap-1">
          <label htmlFor="summary-date" className="text-xs text-muted-foreground">
            日期筛选
          </label>
          <Input
            id="summary-date"
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyDate(dateInput)}
            className="h-8 w-44"
          />
        </div>
        <Button variant="default" size="sm" className="mt-5" onClick={() => applyDate(dateInput)}>
          查询
        </Button>
        {date && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-5"
            onClick={() => {
              setDateInput("");
              applyDate("");
            }}
          >
            重置
          </Button>
        )}
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          className="mt-5"
          onClick={triggerSummary}
          disabled={loading || job?.status === "running"}
        >
          <RefreshCw
            className={`h-4 w-4 mr-1.5 ${job?.status === "running" ? "animate-spin" : ""}`}
          />
          重新汇总{dateInput ? `（${dateInput}）` : "（昨日）"}
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
