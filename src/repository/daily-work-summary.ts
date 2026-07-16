"use server";

import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { dailyWorkSummary } from "@/drizzle/portal-schema";
import { users } from "@/drizzle/schema";
import type { WorkSummaryJson } from "@/lib/internal-llm/call";

export interface DailySummaryRow {
  id: number;
  userName: string;
  date: string;
  requestCount: number;
  tagsDebugging: number;
  tagsDocumentation: number;
  tagsCodeGen: number;
  tagsRefactor: number;
  tagsTesting: number;
  tagsOther: number;
  summaryText: string;
  providerId: number | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  generatedAt: Date;
}

export async function upsertDailyWorkSummary(params: {
  userName: string;
  date: string;
  requestCount: number;
  summary: WorkSummaryJson;
  providerId: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const now = new Date();
  await db
    .insert(dailyWorkSummary)
    .values({
      userName: params.userName,
      date: params.date,
      requestCount: params.requestCount,
      tagsDebugging: params.summary.tags.debugging,
      tagsDocumentation: params.summary.tags.documentation,
      tagsCodeGen: params.summary.tags.code_gen,
      tagsRefactor: params.summary.tags.refactor,
      tagsTesting: params.summary.tags.testing,
      tagsOther: params.summary.tags.other,
      summaryText: params.summary.summary,
      providerId: params.providerId,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      generatedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [dailyWorkSummary.userName, dailyWorkSummary.date],
      set: {
        requestCount: params.requestCount,
        tagsDebugging: params.summary.tags.debugging,
        tagsDocumentation: params.summary.tags.documentation,
        tagsCodeGen: params.summary.tags.code_gen,
        tagsRefactor: params.summary.tags.refactor,
        tagsTesting: params.summary.tags.testing,
        tagsOther: params.summary.tags.other,
        summaryText: params.summary.summary,
        providerId: params.providerId,
        model: params.model,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        generatedAt: now,
        updatedAt: now,
      },
    });
}

export async function listDailySummariesByDate(date: string): Promise<DailySummaryRow[]> {
  const rows = await db
    .select()
    .from(dailyWorkSummary)
    .where(eq(dailyWorkSummary.date, date))
    .orderBy(desc(dailyWorkSummary.requestCount));
  return rows as DailySummaryRow[];
}

export async function getDailySummary(
  userName: string,
  date: string
): Promise<DailySummaryRow | null> {
  const [row] = await db
    .select()
    .from(dailyWorkSummary)
    .where(and(eq(dailyWorkSummary.userName, userName), eq(dailyWorkSummary.date, date)));
  return (row as DailySummaryRow) ?? null;
}

export async function listRecentDatesByUser(userName: string, limit = 30): Promise<string[]> {
  const rows = await db
    .select({ date: dailyWorkSummary.date })
    .from(dailyWorkSummary)
    .where(eq(dailyWorkSummary.userName, userName))
    .orderBy(desc(dailyWorkSummary.date))
    .limit(limit);
  return rows.map((r) => r.date);
}

export async function listSummaryUsers(): Promise<
  Array<{ userName: string; latestDate: string; totalRequests: number }>
> {
  const rows = await db
    .select({
      userName: dailyWorkSummary.userName,
      latestDate: dailyWorkSummary.date,
      requestCount: dailyWorkSummary.requestCount,
    })
    .from(dailyWorkSummary)
    .orderBy(asc(dailyWorkSummary.userName), desc(dailyWorkSummary.date));

  // client-side aggregate: latest date + total per user
  const userMap = new Map<string, { latestDate: string; totalRequests: number }>();
  for (const row of rows) {
    const existing = userMap.get(row.userName);
    if (!existing) {
      userMap.set(row.userName, { latestDate: row.latestDate, totalRequests: row.requestCount });
    } else {
      existing.totalRequests += row.requestCount;
      if (row.latestDate > existing.latestDate) existing.latestDate = row.latestDate;
    }
  }
  return Array.from(userMap.entries()).map(([userName, v]) => ({ userName, ...v }));
}

export async function listLatestSummariesPerUser(): Promise<DailySummaryRow[]> {
  const subquery = db
    .select({
      userName: dailyWorkSummary.userName,
      maxDate: sql<string>`MAX(${dailyWorkSummary.date})`.as("maxDate"),
    })
    .from(dailyWorkSummary)
    .groupBy(dailyWorkSummary.userName)
    .as("latest");

  const rows = await db
    .select()
    .from(dailyWorkSummary)
    .innerJoin(
      subquery,
      and(
        eq(dailyWorkSummary.userName, subquery.userName),
        eq(dailyWorkSummary.date, subquery.maxDate)
      )
    )
    .orderBy(desc(dailyWorkSummary.requestCount));

  return rows.map((r) => r.daily_work_summary as DailySummaryRow);
}

// AI Accept 2026-07-16 main v1
export interface LatestDailySummaryRun {
  date: string;
  userCount: number;
  generatedAt: Date;
}

/**
 * Returns stats for the most recently generated daily summary batch.
 * Used by the portal dashboard card instead of the Redis job-state key.
 */
export async function getLatestDailySummaryRun(): Promise<LatestDailySummaryRun | null> {
  const [row] = await db
    .select({
      date: dailyWorkSummary.date,
      userCount: sql<number>`cast(count(*) as int)`.as("userCount"),
      generatedAt: sql<Date>`MAX(${dailyWorkSummary.generatedAt})`.as("generatedAt"),
    })
    .from(dailyWorkSummary)
    .groupBy(dailyWorkSummary.date)
    .orderBy(desc(dailyWorkSummary.date))
    .limit(1);
  return row ?? null;
}

export async function listAllUsersWithSummaryByDate(
  date: string
): Promise<Array<DailySummaryRow | { userName: string; date: string; requestCount: null }>> {
  const rows = await db
    .select({
      userName: users.name,
      date: sql<string>`${date}`.as("date"),
      id: dailyWorkSummary.id,
      requestCount: dailyWorkSummary.requestCount,
      tagsDebugging: dailyWorkSummary.tagsDebugging,
      tagsDocumentation: dailyWorkSummary.tagsDocumentation,
      tagsCodeGen: dailyWorkSummary.tagsCodeGen,
      tagsRefactor: dailyWorkSummary.tagsRefactor,
      tagsTesting: dailyWorkSummary.tagsTesting,
      tagsOther: dailyWorkSummary.tagsOther,
      summaryText: dailyWorkSummary.summaryText,
      providerId: dailyWorkSummary.providerId,
      model: dailyWorkSummary.model,
      inputTokens: dailyWorkSummary.inputTokens,
      outputTokens: dailyWorkSummary.outputTokens,
      generatedAt: dailyWorkSummary.generatedAt,
    })
    .from(users)
    .leftJoin(
      dailyWorkSummary,
      and(eq(users.name, dailyWorkSummary.userName), eq(dailyWorkSummary.date, date))
    )
    .where(
      or(
        and(isNull(users.deletedAt), eq(users.isEnabled, true)),
        sql`${dailyWorkSummary.id} IS NOT NULL`
      )
    )
    .orderBy(sql`${dailyWorkSummary.requestCount} DESC NULLS LAST`, asc(users.name));

  return rows.map((r) =>
    r.id ? (r as DailySummaryRow) : { userName: r.userName, date: r.date, requestCount: null }
  ) as Array<DailySummaryRow | { userName: string; date: string; requestCount: null }>;
}
