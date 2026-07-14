// AI Accept 2026-07-14 main v1
"use client";

import { RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type BatchJobState = {
  jobId: string;
  status: "running" | "done" | "failed" | "not_found";
  period: string;
  periodStart: string;
  userCount: number;
  startedAt?: string;
  finishedAt?: string;
  result?: {
    dateStr: string;
    total: number;
    ok: number;
    failed: number;
    failedUsers?: Array<{ userName: string; reason: string }>;
  };
  error?: string;
};

interface BatchActionsBarProps {
  selectedCount: number;
  selectedItems: Array<{ userName: string; date: string }>;
  periodStart: string;
  onClear: () => void;
}

// AI Accept 2026-07-14 main v1
export function BatchActionsBar({
  selectedCount,
  selectedItems,
  periodStart,
  onClear,
}: BatchActionsBarProps) {
  const router = useRouter();
  const [job, setJob] = useState<BatchJobState | null>(null);
  const [loading, setLoading] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    },
    []
  );

  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  async function pollJob(jobId: string) {
    try {
      const res = await fetch(`/api/portal/summaries/batch?jobId=${encodeURIComponent(jobId)}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as BatchJobState;
      setJob(data);
      if (data.status === "done") {
        stopPolling();
        if (data.result && data.result.ok > 0) {
          router.refresh();
          onClear();
        }
      } else if (data.status === "failed") {
        stopPolling();
      }
    } catch (e) {
      setJob((prev) => ({
        jobId,
        status: "failed",
        period: prev?.period ?? "day",
        periodStart: prev?.periodStart ?? "",
        userCount: prev?.userCount ?? 0,
        error: `轮询异常：${e instanceof Error ? e.message : String(e)}`,
      }));
      stopPolling();
    }
  }

  async function triggerBatch() {
    setLoading(true);
    setJob(null);
    const userNames = selectedItems.map((item) => item.userName);
    try {
      const res = await fetch("/api/portal/summaries/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userNames, period: "day", periodStart }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJob({
          jobId: "",
          status: "failed",
          period: "day",
          periodStart,
          userCount: userNames.length,
          error: data.error ?? res.statusText,
        });
        return;
      }
      const jobId = data.jobId as string;
      setJob({
        jobId,
        status: "running",
        period: "day",
        periodStart,
        userCount: userNames.length,
      });
      stopPolling();
      pollTimerRef.current = setInterval(() => void pollJob(jobId), 3000);
      void pollJob(jobId);
    } catch (e) {
      setJob({
        jobId: "",
        status: "failed",
        period: "day",
        periodStart,
        userCount: userNames.length,
        error: `请求异常：${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setLoading(false);
    }
  }

  if (selectedCount === 0) return null;

  const isRunning = job?.status === "running";
  const resultText = (() => {
    if (!job) return null;
    if (job.status === "running") return "批量汇总中...";
    if (job.status === "failed") return `失败：${job.error ?? "未知错误"}`;
    const r = job.result;
    if (!r) return null;
    let msg = `完成：共 ${r.total} 用户，成功 ${r.ok}，失败 ${r.failed}`;
    if (r.failedUsers && r.failedUsers.length > 0) {
      msg += "\n失败用户：";
      for (const u of r.failedUsers) msg += `\n  - ${u.userName}: ${u.reason}`;
    }
    return msg;
  })();

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-accent/40 px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          已选 <span className="font-medium text-foreground">{selectedCount}</span> 项
        </span>
        <Button variant="default" size="sm" onClick={triggerBatch} disabled={loading || isRunning}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isRunning ? "animate-spin" : ""}`} />
          批量汇总 {selectedCount} 项
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={isRunning}>
          <X className="h-4 w-4 mr-1" />
          取消选择
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
