// AI Accept 2026-07-18 main v1
"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function SummaryCell({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default line-clamp-1 break-words">{text}</span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          collisionPadding={16}
          className="max-w-[min(42rem,var(--radix-tooltip-content-available-width))] text-xs text-left text-pretty"
        >
          <div className="max-h-[calc(var(--radix-tooltip-content-available-height)-2rem)] overflow-y-auto overscroll-contain leading-relaxed whitespace-pre-wrap break-words">
            {text}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
