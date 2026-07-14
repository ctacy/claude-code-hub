// AI Accept 2026-07-14 main v1
"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopySummaryButton({
  text,
  className,
  size = "sm",
}: {
  text: string;
  className?: string;
  size?: "sm" | "icon";
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板权限被拒绝或不可用时静默失败，不打断用户操作
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={size === "icon" ? "icon" : "sm"}
      className={cn("text-muted-foreground hover:text-foreground", className)}
      onClick={handleCopy}
      disabled={!text}
      title="复制工作总结"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      {size === "sm" && <span className="ml-1 text-xs">{copied ? "已复制" : "复制"}</span>}
    </Button>
  );
}
