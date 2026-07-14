// AI Accept 2026-07-14 main v1
import { type NextRequest, NextResponse } from "next/server";
import type { Currency } from "@/lib/portal/currency";
import { PORTAL_CURRENCY_COOKIE_NAME } from "@/lib/portal/currency-cookie";

export const runtime = "nodejs";

const VALID_CURRENCIES: readonly Currency[] = ["USD", "CNY", "EUR", "JPY"];

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const currency = (body as { currency?: string }).currency;
  if (!currency || !VALID_CURRENCIES.includes(currency as Currency)) {
    return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(PORTAL_CURRENCY_COOKIE_NAME, currency, {
    httpOnly: false,
    maxAge: 365 * 24 * 60 * 60,
    path: "/",
    sameSite: "lax",
  });
  return response;
}
