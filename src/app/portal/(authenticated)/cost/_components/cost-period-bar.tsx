"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

type Period = "daily" | "weekly" | "monthly" | "allTime";

const PERIODS: { value: Period; label: string }[] = [
  { value: "daily", label: "今日" },
  { value: "weekly", label: "本周" },
  { value: "monthly", label: "本月" },
  { value: "allTime", label: "全部" },
];

export function CostPeriodBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = (searchParams.get("period") as Period | null) ?? "daily";

  function apply(period: Period) {
    const params = new URLSearchParams();
    params.set("period", period);
    router.push(`/portal/cost?${params}`);
  }

  return (
    <div className="flex gap-1">
      {PERIODS.map((p) => (
        <Button
          key={p.value}
          variant={current === p.value ? "default" : "ghost"}
          size="sm"
          onClick={() => apply(p.value)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
