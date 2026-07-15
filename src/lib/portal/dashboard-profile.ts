// AI Accept 2026-07-15 main v1
import "server-only";

import {
  findPeriodLeaderboardWithPriorPeriod,
  findWeeklyProviderLeaderboard,
  type ProviderLeaderboardEntry,
} from "@/repository/leaderboard";
import type { DatabaseStatRow } from "@/types/statistics";

/** 用户周对比数据：本期 vs 上期按用户聚合。prior 缺失视为 0（新增用户）。 */
export interface WeeklyCostRow {
  userId: number;
  userName: string;
  currentCost: number;
  priorCost: number;
  /** 百分比变化，prior 为 0 时为 null（视为新增） */
  deltaPct: number | null;
}

export async function getWeeklyCostProfile(): Promise<WeeklyCostRow[]> {
  const { current, prior } = await findPeriodLeaderboardWithPriorPeriod("weekly");
  const priorMap = new Map<number, number>();
  for (const row of prior) priorMap.set(row.userId, row.totalCost);

  const rows: WeeklyCostRow[] = current.map((row) => {
    const priorCost = priorMap.get(row.userId) ?? 0;
    return {
      userId: row.userId,
      userName: row.userName,
      currentCost: round4(row.totalCost),
      priorCost: round4(priorCost),
      deltaPct:
        priorCost > 0 ? Number((((row.totalCost - priorCost) / priorCost) * 100).toFixed(2)) : null,
    };
  });

  return sortByAbsDelta(rows);
}

/** 按 |deltaPct| 降序；null（新增用户）沉底 */
export function sortByAbsDelta(rows: WeeklyCostRow[]): WeeklyCostRow[] {
  return [...rows].sort((a, b) => {
    const av = a.deltaPct === null ? Number.NEGATIVE_INFINITY : Math.abs(a.deltaPct);
    const bv = b.deltaPct === null ? Number.NEGATIVE_INFINITY : Math.abs(b.deltaPct);
    return bv - av;
  });
}

/**
 * 近 7 日按日聚合：返回 series 数组（用于 AreaChart）与 totals。
 * 输入为按用户×日的原始行；输出每天的总费用与总请求数。
 */
export interface DailyTrendPoint {
  date: string; // YYYY-MM-DD
  totalCost: number;
  totalRequests: number;
}

export interface DailyTrendResult {
  series: DailyTrendPoint[];
  totalCost: number;
  totalRequests: number;
}

export function aggregateDailyTotals(rows: DatabaseStatRow[]): DailyTrendResult {
  const byDate = new Map<string, { cost: number; calls: number }>();
  for (const row of rows) {
    // 数据库层 date 实际是 Date 对象；规格定义是 string，这里双适配
    const dateStr = normalizeDate(row.date);
    if (!dateStr) continue;
    const acc = byDate.get(dateStr) ?? { cost: 0, calls: 0 };
    acc.cost += toNumber(row.total_cost);
    acc.calls += row.api_calls ?? 0;
    byDate.set(dateStr, acc);
  }

  const series: DailyTrendPoint[] = Array.from(byDate.entries())
    .map(([date, agg]) => ({
      date,
      totalCost: round4(agg.cost),
      totalRequests: agg.calls,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalCost = round4(series.reduce((s, p) => s + p.totalCost, 0));
  const totalRequests = series.reduce((s, p) => s + p.totalRequests, 0);

  return { series, totalCost, totalRequests };
}

/**
 * Provider 周榜归一为前端展示模型：截断至前 N 条并把 null 成功率/TTFB 收尾为 0。
 */
export interface ProviderTopRow {
  providerId: number;
  providerName: string;
  totalCost: number;
  totalRequests: number;
  successRate: number; // 0-1
  avgTtfbMs: number;
}

const PROVIDER_TOP_LIMIT = 6;

export function normalizeProviderRows(rows: ProviderLeaderboardEntry[]): ProviderTopRow[] {
  return rows.slice(0, PROVIDER_TOP_LIMIT).map((row) => ({
    providerId: row.providerId,
    providerName: row.providerName,
    totalCost: round4(row.totalCost),
    totalRequests: row.totalRequests,
    successRate: row.successRate ?? 0,
    avgTtfbMs: Math.round(row.avgTtfbMs),
  }));
}

export async function getWeeklyProviderTop(): Promise<ProviderTopRow[]> {
  const rows = await findWeeklyProviderLeaderboard(undefined, false);
  return normalizeProviderRows(rows);
}

function toNumber(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function normalizeDate(d: unknown): string | null {
  if (!d) return null;
  if (typeof d === "string") {
    // 已是 YYYY-MM-DD 或 ISO 串，截断前 10
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
    return null;
  }
  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}
