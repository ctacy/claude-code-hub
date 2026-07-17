// AI Accept 2026-07-16 main v1
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { TimeRange } from "@/types/statistics";

const TREND_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "today", label: "今天" },
  { value: "7days", label: "过去 7 天" },
  { value: "30days", label: "过去 30 天" },
  { value: "thisMonth", label: "本月" },
];

export function TrendRangeSelector({ value }: { value: TimeRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleSelect(range: TimeRange) {
    if (range === value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("trend", range);
    router.push(`${pathname}?${params}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {TREND_RANGE_OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          variant={value === opt.value ? "default" : "outline"}
          size="sm"
          className="h-7"
          onClick={() => handleSelect(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
