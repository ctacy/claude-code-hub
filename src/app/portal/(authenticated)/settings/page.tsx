"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PortalSettingsPage() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("");
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/portal/settings")
      .then((r) => r.json())
      .then((data) => {
        setDefaultPrompt(data.defaultPrompt ?? "");
        setPrompt(data.prompt ?? "");
        setModel(data.model ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/portal/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model }),
      });
      const data = await res.json();
      setMsg(res.ok ? "保存成功" : `保存失败：${data.error ?? res.statusText}`);
    } catch (e) {
      setMsg(`请求异常：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setPrompt("");
    setModel("");
    setMsg(null);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">配置工作总结生成提示词和模型。</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">LLM 模型</h2>
        <p className="text-xs text-muted-foreground">
          留空则按 Provider 类型使用内置默认值（Claude → claude-haiku-4-5-20251001，OpenAI-compatible/Codex → gpt-4.1-mini，Gemini → gemini-2.5-flash）。
        </p>
        <Input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={loading}
          placeholder="例：claude-opus-4-8 / gpt-4o / gemini-2.0-flash"
          className="h-9 font-mono"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">工作总结提示词</h2>
          <span className="text-xs text-muted-foreground">
            可用变量：<code className="bg-muted px-1 rounded">{"{userName}"}</code>{" "}
            <code className="bg-muted px-1 rounded">{"{date}"}</code>{" "}
            <code className="bg-muted px-1 rounded">{"{requestCount}"}</code>{" "}
            <code className="bg-muted px-1 rounded">{"{logsText}"}</code>
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          留空则使用内置默认提示词。修改后下次汇总时生效。
        </p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
          rows={16}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          placeholder={loading ? "加载中…" : "留空使用内置默认提示词"}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving || loading} size="sm">
          {saving ? "保存中…" : "保存"}
        </Button>
        <Button variant="ghost" size="sm" onClick={reset} disabled={saving || loading}>
          恢复默认
        </Button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground">内置默认提示词（只读参考）</h3>
        <pre className="rounded-md border bg-muted/30 px-3 py-2 text-xs font-mono whitespace-pre-wrap text-muted-foreground">
          {defaultPrompt}
        </pre>
      </div>
    </div>
  );
}
