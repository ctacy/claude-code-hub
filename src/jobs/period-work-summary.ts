// AI Accept 2026-07-12 main v2
import { endOfMonth, endOfWeek, endOfYear, format, parseISO } from "date-fns";
import { and, gte, lt, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { dailyWorkSummary } from "@/drizzle/portal-schema";
import { DEFAULT_SUMMARY_PROMPT, SUMMARY_CHAR_LIMITS } from "@/jobs/daily-work-summary";
import type { InternalLlmError } from "@/lib/internal-llm/call";
import { callInternalLlmForSummary } from "@/lib/internal-llm/call";
import { pickInternalLlmProvider } from "@/lib/internal-llm/pick-provider";
import { logger } from "@/lib/logger";
import { resolveSystemTimezone } from "@/lib/utils/timezone";
import { getDailySummaryGroups } from "@/repository/daily-summary-groups";
import { upsertPeriodWorkSummary } from "@/repository/period-work-summary";
import { getSystemSettings } from "@/repository/system-config";

function formatLlmError(error: InternalLlmError): string {
  switch (error.reason) {
    case "fetch_failed":
      return `fetch_failed: ${error.detail ?? "unknown"}`;
    case "non_200":
      return `non_200 (${error.status}): ${error.preview ?? ""}`.slice(0, 150);
    case "empty_content":
      return `empty_content: ${error.preview ?? ""}`.slice(0, 150);
    case "parse_failed":
      return `parse_failed: ${error.detail ?? ""} | ${error.preview ?? ""}`.slice(0, 150);
    case "invalid_structure":
      return `invalid_structure: ${error.preview ?? ""}`.slice(0, 150);
    default:
      return `unknown: ${JSON.stringify(error)}`.slice(0, 150);
  }
}

export interface PeriodRunResult {
  dateStr: string;
  total: number;
  ok: number;
  failed: number;
  failureReason?: string;
  failedUsers?: Array<{ userName: string; reason: string }>;
}

function computePeriodBounds(
  periodType: "week" | "month" | "year",
  periodStart: string
): {
  start: string;
  end: string;
} {
  const date = parseISO(periodStart);
  let endDate: Date;
  switch (periodType) {
    case "week":
      endDate = endOfWeek(date, { weekStartsOn: 1 });
      break;
    case "month":
      endDate = endOfMonth(date);
      break;
    case "year":
      endDate = endOfYear(date);
      break;
  }
  return {
    start: periodStart,
    end: format(endDate, "yyyy-MM-dd"),
  };
}

// AI Accept 2026-07-14 main v3
// 与日报共用 DEFAULT_SUMMARY_PROMPT（daily-work-summary.ts），按周期语义映射占位符。
// {requestCount} 替换值须自带完整量词短语（模板不再拼接"条"/"天"等字样，避免病句）：
//   {date}         "本周/本月/本年（起始日 ~ 结束日）"
//   {requestCount} "N 天工作总结"（含完整量词短语）
//   {logsText}     每日总结拼接文本
//   {charLimit}    与日报（500字）梯度衔接：周 1000 / 月 1500 / 年 2000
function buildPrompt(
  userName: string,
  periodType: "week" | "month" | "year",
  periodStart: string,
  periodEnd: string,
  dayCount: number,
  dailySummaries: Array<{ date: string; summary: string }>,
  template?: string | null
): string {
  const periodLabel = { week: "本周", month: "本月", year: "本年" }[periodType];
  const charLimit = SUMMARY_CHAR_LIMITS[periodType];
  const dateLabel = `${periodLabel}（${periodStart} ~ ${periodEnd}）`;
  const summariesText = dailySummaries.map((d) => `【${d.date}】${d.summary}`).join("\n");

  return (template || DEFAULT_SUMMARY_PROMPT)
    .replace(/\{userName\}/g, userName)
    .replace(/\{date\}/g, dateLabel)
    .replace(/\{requestCount\}/g, `${dayCount} 天工作总结`)
    .replace(/\{logsText\}/g, summariesText)
    .replace(/\{charLimit\}/g, String(charLimit));
}

export async function runPeriodWorkSummary(options: {
  periodType: "week" | "month" | "year";
  periodStart: string;
}): Promise<PeriodRunResult> {
  const { periodType, periodStart } = options;
  const timezone = await resolveSystemTimezone();
  const { start, end } = computePeriodBounds(periodType, periodStart);

  logger.info("[PeriodWorkSummary] Starting", { periodType, periodStart, start, end, timezone });

  // 与日报共用同一份用户自定义提示词（system_settings.dailySummaryPrompt）
  const settings = await getSystemSettings().catch(() => null);
  const promptTemplate = settings?.dailySummaryPrompt ?? null;

  const configuredGroups = await getDailySummaryGroups().catch(() => []);
  const activeGroups = configuredGroups.filter((g) => g.enabled);

  const FALLBACK_TIERS = [
    { name: "Claude", groupTag: null as string | null, model: null as string | null },
    { name: "Codex", groupTag: null as string | null, model: null as string | null },
  ];
  const FALLBACK_PROVIDER_TYPES: Record<string, string[]> = {
    Claude: ["claude", "claude-auth"],
    Codex: ["openai-compatible", "codex"],
  };

  const tiers =
    activeGroups.length > 0
      ? activeGroups.map((g) => ({ name: g.name, groupTag: g.groupTag, model: g.model }))
      : FALLBACK_TIERS;

  const rows = await db
    .select({
      userName: dailyWorkSummary.userName,
      date: dailyWorkSummary.date,
      requestCount: dailyWorkSummary.requestCount,
      summaryText: dailyWorkSummary.summaryText,
      tagsDebugging: dailyWorkSummary.tagsDebugging,
      tagsDocumentation: dailyWorkSummary.tagsDocumentation,
      tagsCodeGen: dailyWorkSummary.tagsCodeGen,
      tagsRefactor: dailyWorkSummary.tagsRefactor,
      tagsTesting: dailyWorkSummary.tagsTesting,
      tagsOther: dailyWorkSummary.tagsOther,
    })
    .from(dailyWorkSummary)
    .where(
      and(
        gte(dailyWorkSummary.date, start),
        lt(dailyWorkSummary.date, sql`(${end}::date + INTERVAL '1 day')::varchar`),
        sql`${dailyWorkSummary.requestCount} > 0`
      )
    );

  if (rows.length === 0) {
    logger.info("[PeriodWorkSummary] No daily summaries for period", { periodType, start, end });
    return { dateStr: start, total: 0, ok: 0, failed: 0 };
  }

  const byUser = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!byUser.has(row.userName)) byUser.set(row.userName, []);
    byUser.get(row.userName)!.push(row);
  }

  const userEntries = Array.from(byUser.entries());

  const perUserResults = await Promise.all(
    userEntries.map(
      async ([userName, userDays]): Promise<{ ok: boolean; userName: string; reason?: string }> => {
        try {
          const dayCount = userDays.length;
          const totalRequests = userDays.reduce((sum, d) => sum + d.requestCount, 0);
          const dailySummaries = userDays.map((d) => ({
            date: d.date,
            summary: d.summaryText,
          }));

          const aggregatedTags = {
            debugging: userDays.reduce((s, d) => s + d.tagsDebugging, 0),
            documentation: userDays.reduce((s, d) => s + d.tagsDocumentation, 0),
            code_gen: userDays.reduce((s, d) => s + d.tagsCodeGen, 0),
            refactor: userDays.reduce((s, d) => s + d.tagsRefactor, 0),
            testing: userDays.reduce((s, d) => s + d.tagsTesting, 0),
            other: userDays.reduce((s, d) => s + d.tagsOther, 0),
          };

          const prompt = buildPrompt(
            userName,
            periodType,
            start,
            end,
            dayCount,
            dailySummaries,
            promptTemplate
          );
          let lastError: string | undefined;

          for (const tier of tiers) {
            const excludedIds: number[] = [];
            const fallbackTypes =
              tier.groupTag == null ? FALLBACK_PROVIDER_TYPES[tier.name] : undefined;

            for (;;) {
              const provider = await pickInternalLlmProvider(
                excludedIds,
                fallbackTypes,
                tier.groupTag
              );
              if (!provider) break;

              const result = await callInternalLlmForSummary(provider, prompt, tier.model);
              if (result.ok) {
                await upsertPeriodWorkSummary({
                  userName,
                  periodType,
                  periodStart: start,
                  periodEnd: end,
                  requestCount: totalRequests,
                  dayCount,
                  summary: {
                    tags: aggregatedTags,
                    summary: result.result.data.summary,
                  },
                  providerId: provider.id,
                  model: result.result.model,
                  inputTokens: result.result.inputTokens,
                  outputTokens: result.result.outputTokens,
                });
                logger.info("[PeriodWorkSummary] User done", {
                  userName,
                  periodType,
                  periodStart,
                  dayCount,
                  tier: tier.name,
                  providerType: provider.providerType,
                });
                return { ok: true as const, userName };
              }

              lastError = formatLlmError(result.error);
              excludedIds.push(provider.id);
              logger.warn("[PeriodWorkSummary] Provider failed, trying next", {
                userName,
                periodType,
                periodStart,
                providerId: provider.id,
                tier: tier.name,
                reason: lastError,
              });
            }
          }

          logger.error("[PeriodWorkSummary] All providers exhausted", {
            userName,
            periodType,
            periodStart,
          });
          return { ok: false as const, userName, reason: lastError ?? "all providers exhausted" };
        } catch (error) {
          const reason = `unexpected: ${error instanceof Error ? error.message : String(error)}`;
          logger.error("[PeriodWorkSummary] Unexpected error for user", {
            userName,
            periodType,
            periodStart,
            error: reason,
          });
          return { ok: false, userName, reason };
        }
      }
    )
  );

  const okCount = perUserResults.filter((r) => r.ok).length;
  const failedUsers = perUserResults
    .filter((r) => !r.ok)
    .map((r) => ({ userName: r.userName, reason: r.reason ?? "unknown" }));

  const result: PeriodRunResult = {
    dateStr: start,
    total: byUser.size,
    ok: okCount,
    failed: failedUsers.length,
    failedUsers: failedUsers.length > 0 ? failedUsers : undefined,
  };
  logger.info("[PeriodWorkSummary] Done", result);
  return result;
}
