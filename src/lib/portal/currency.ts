// AI Accept 2026-07-14 main v1

/** Supported display currencies for portal cost views */
export type Currency = "USD" | "CNY" | "EUR" | "JPY";

/** Exchange rates relative to USD */
export interface ExchangeRates {
  CNY: number;
  EUR: number;
  JPY: number;
}

export const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  CNY: 7.2,
  EUR: 0.92,
  JPY: 150,
};

/**
 * Read exchange rates from environment variables.
 * Server-side only — reads process.env.
 */
export function getExchangeRates(): ExchangeRates {
  return {
    CNY: parseFloat(process.env.PORTAL_USD_TO_CNY ?? "") || DEFAULT_EXCHANGE_RATES.CNY,
    EUR: parseFloat(process.env.PORTAL_USD_TO_EUR ?? "") || DEFAULT_EXCHANGE_RATES.EUR,
    JPY: parseFloat(process.env.PORTAL_USD_TO_JPY ?? "") || DEFAULT_EXCHANGE_RATES.JPY,
  };
}

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "$",
  CNY: "¥",
  EUR: "€",
  JPY: "¥",
};

/**
 * Convert a USD amount to the target currency using the provided rates.
 */
export function convertCurrency(
  usd: number,
  currency: Currency,
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES
): number {
  if (currency === "USD") return usd;
  return usd * rates[currency];
}

/**
 * Format a USD amount as a display string in the target currency.
 * - value < 0.01: 4 decimal places
 * - value >= 0.01: 2 decimal places with thousands separator
 */
export function formatMoney(
  usd: number,
  currency: Currency,
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES
): string {
  const value = convertCurrency(usd, currency, rates);
  const symbol = CURRENCY_SYMBOLS[currency];

  if (value === 0) return `${symbol}0.0000`;

  const abs = Math.abs(value);
  if (abs < 0.01) {
    return `${symbol}${value.toFixed(4)}`;
  }

  return `${symbol}${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
