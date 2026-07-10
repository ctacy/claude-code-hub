"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SummariesToolbar({ date }: { date?: string }) {
  const router = useRouter();
  const [dateInput, setDateInput] = useState(date ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function applyDate(value: string) {
    const params = new URLSearchParams();
    if (value) params.set("date", value);
    router.push(`/portal/summaries${value ? `?${params}` : ""}`);
  }

  async function triggerSummary() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/portal/summaries/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateInput || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(`失败：${data.error ?? res.statusText}`);
      } else {
        let msg = `完成：${data.dateStr} 共 ${data.total} 用户，成功 ${data.ok}，失败 ${data.failed}`;
        if (data.failureReason) {
          msg += `\n原因：${data.failureReason}`;
        }
        if (data.failedUsers && data.failedUsers.length > 0) {
          msg += "\n失败用户：";
          for (const { userName, reason } of data.failedUsers) {
            msg += `\n  - ${userName}: ${reason}`;
          }
        }
        setResult(msg);
        if (data.ok > 0) router.refresh();
      }
    } catch (e) {
      setResult(`请求异常：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

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
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          重新汇总{dateInput ? `（${dateInput}）` : "（昨日）"}
        </Button>
      </div>
      {result && (
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans">{result}</pre>
      )}
    </div>
  );
}
