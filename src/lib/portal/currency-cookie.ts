// AI Accept 2026-07-14 main v1

import type { Currency } from "./currency";

export const PORTAL_CURRENCY_COOKIE_NAME = "portal_currency";

const VALID_CURRENCIES: readonly Currency[] = ["USD", "CNY", "EUR", "JPY"];

function isValidCurrency(value: string): value is Currency {
  return VALID_CURRENCIES.includes(value as Currency);
}

/**
 * Read the currency preference from a Next.js cookie store (server-side).
 * Accepts the ReadonlyRequestCookies object from next/headers.
 * Returns "USD" if the cookie is absent or invalid.
 */
export function getCurrentCurrency(cookieStore?: {
  get: (name: string) => { value: string } | undefined;
}): Currency {
  const raw = cookieStore?.get(PORTAL_CURRENCY_COOKIE_NAME)?.value ?? "";
  if (isValidCurrency(raw)) return raw;
  return "USD";
}
