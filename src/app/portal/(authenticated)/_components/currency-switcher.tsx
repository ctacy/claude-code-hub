// AI Accept 2026-07-14 main v1
"use client";

import { useRouter } from "next/navigation";
import type { Currency } from "@/lib/portal/currency";

const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: "USD", label: "USD ($)" },
  { value: "CNY", label: "CNY (¥)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "JPY", label: "JPY (¥)" },
];

/** Client-side currency switcher. Persists selection via cookie and triggers a server refresh. */
export function CurrencySwitcher({ currentCurrency }: { currentCurrency: Currency }) {
  const router = useRouter();

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value as Currency;
    await fetch("/api/portal/currency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency: value }),
    });
    router.refresh();
  }

  return (
    <select
      value={currentCurrency}
      onChange={handleChange}
      aria-label="Display currency"
      className="h-8 rounded-md border border-blue-500 bg-background px-2 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      {CURRENCY_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
