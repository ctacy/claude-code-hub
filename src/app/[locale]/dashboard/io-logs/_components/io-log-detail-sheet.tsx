"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/relative-time";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { IoLogItem } from "@/lib/api-client/v1/actions/io-logs";

interface IoLogDetailSheetProps {
  log: IoLogItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground text-xs italic">—</span>;
  }
  return (
    <pre className="text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

function statusVariant(code: number | null): "default" | "destructive" | "outline" | "secondary" {
  if (!code) return "outline";
  if (code >= 200 && code < 300) return "default";
  if (code >= 400) return "destructive";
  return "secondary";
}

export function IoLogDetailSheet({ log, open, onOpenChange }: IoLogDetailSheetProps) {
  const t = useTranslations("ioLogs");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl overflow-hidden"
      >
        <SheetHeader className="flex flex-row items-center justify-between border-b px-4 py-3 shrink-0">
          <SheetTitle className="text-base font-semibold">{t("detail.title")}</SheetTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </SheetHeader>

        {log && (
          <div className="flex flex-col gap-0 overflow-y-auto flex-1">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2.5 text-sm">
              <span className="font-mono text-xs text-muted-foreground">#{log.requestId}</span>
              {log.userName && (
                <span className="text-xs text-foreground font-medium">{log.userName}</span>
              )}
              {log.keyName && (
                <Badge variant="outline" className="text-[10px]">
                  {log.keyName}
                </Badge>
              )}
              {(log.originalModel ?? log.model) && (
                <Badge variant="secondary" className="text-[10px]">
                  {log.originalModel ?? log.model}
                </Badge>
              )}
              {log.statusCode && (
                <Badge variant={statusVariant(log.statusCode)} className="text-[10px]">
                  {log.statusCode}
                </Badge>
              )}
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                <RelativeTime date={log.createdAt} fallback="—" />
              </span>
            </div>

            {/* Request */}
            <div className="flex flex-col border-b">
              <div className="flex items-center gap-2 bg-muted/20 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t("detail.requestBody")}
              </div>
              <div className="max-h-[45vh] overflow-auto p-4 bg-muted/10">
                <JsonBlock value={log.requestBody} />
              </div>
            </div>

            {/* Response */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 bg-muted/20 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t("detail.responseBody")}
              </div>
              <div className="max-h-[45vh] overflow-auto p-4 bg-muted/10">
                <JsonBlock value={log.responseBody} />
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
