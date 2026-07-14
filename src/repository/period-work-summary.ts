// AI Accept 2026-07-12 main v1
"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { periodWorkSummary } from "@/drizzle/portal-schema";
import type { WorkSummaryJson } from "@/lib/internal-llm/call";

export interface PeriodSummaryRow {
  id: number;
  userName: string;
  periodType: "week" | "month" | "year";
  periodStart: string;
  periodEnd: string;
  requestCount: number;
  dayCount: number;
  tagsDebugging: number;
  tagsDocumentation: number;
  tagsCodeGen: number;
  tagsRefactor: number;
  tagsTesting: number;
  tagsOther: number;
  summaryText: string | null;
  providerId: number | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export async function upsertPeriodWorkSummary(params: {
  userName: string;
  periodType: "week" | "month" | "year";
  periodStart: string;
  periodEnd: string;
  requestCount: number;
  dayCount: number;
  summary: WorkSummaryJson;
  providerId: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const now = new Date();
  await db
    .insert(periodWorkSummary)
    .values({
      userName: params.userName,
      periodType: params.periodType,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      requestCount: params.requestCount,
      dayCount: params.dayCount,
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
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        periodWorkSummary.userName,
        periodWorkSummary.periodType,
        periodWorkSummary.periodStart,
      ],
      set: {
        periodEnd: params.periodEnd,
        requestCount: params.requestCount,
        dayCount: params.dayCount,
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
        updatedAt: now,
      },
    });
}

export async function getPeriodSummary(
  userName: string,
  periodType: "week" | "month" | "year",
  periodStart: string
): Promise<PeriodSummaryRow | null> {
  const [row] = await db
    .select()
    .from(periodWorkSummary)
    .where(
      and(
        eq(periodWorkSummary.userName, userName),
        eq(periodWorkSummary.periodType, periodType),
        eq(periodWorkSummary.periodStart, periodStart)
      )
    );
  return (row as PeriodSummaryRow) ?? null;
}

export async function listPeriodSummariesByPeriod(
  periodType: "week" | "month" | "year",
  periodStart: string
): Promise<PeriodSummaryRow[]> {
  const rows = await db
    .select()
    .from(periodWorkSummary)
    .where(
      and(
        eq(periodWorkSummary.periodType, periodType),
        eq(periodWorkSummary.periodStart, periodStart)
      )
    )
    .orderBy(desc(periodWorkSummary.requestCount));
  return rows as PeriodSummaryRow[];
}

export async function listLatestPeriodSummariesPerUser(
  periodType: "week" | "month" | "year"
): Promise<PeriodSummaryRow[]> {
  const subquery = db
    .select({
      userName: periodWorkSummary.userName,
      maxPeriodStart: sql<string>`MAX(${periodWorkSummary.periodStart})`.as("maxPeriodStart"),
    })
    .from(periodWorkSummary)
    .where(eq(periodWorkSummary.periodType, periodType))
    .groupBy(periodWorkSummary.userName)
    .as("latest");

  const rows = await db
    .select()
    .from(periodWorkSummary)
    .innerJoin(
      subquery,
      and(
        eq(periodWorkSummary.userName, subquery.userName),
        eq(periodWorkSummary.periodStart, subquery.maxPeriodStart),
        eq(periodWorkSummary.periodType, periodType)
      )
    )
    .orderBy(desc(periodWorkSummary.requestCount));

  return rows.map((r) => r.period_work_summary as PeriodSummaryRow);
}
