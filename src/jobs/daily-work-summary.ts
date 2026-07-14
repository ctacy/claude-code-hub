/**
 * daily-work-summary job — 每天凌晨 0:30(系统配置时区)为昨日全量用户生成 AI 工作总结
 *
 * 时区口径与 repository/leaderboard.ts 一致：优先 system_settings.timezone，其次 env TZ，
 * 最后 UTC 兜底 —— 不使用进程本地时区/朴素 Date API，避免"系统设置的时区"与
 * "定时任务触发时刻/日期边界计算"之间出现错位（同一份口径也用于 daily-leaderboard 通知）。
 */
import { and, isNotNull, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { requestIoLog } from "@/drizzle/io-log-schema";
import type { InternalLlmError } from "@/lib/internal-llm/call";
import { callInternalLlmForSummary } from "@/lib/internal-llm/call";
import { pickInternalLlmProvider } from "@/lib/internal-llm/pick-provider";
import { logger } from "@/lib/logger";
import { resolveSystemTimezone } from "@/lib/utils/timezone";
import { getDailySummaryGroups } from "@/repository/daily-summary-groups";
import { upsertDailyWorkSummary } from "@/repository/daily-work-summary";
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

export const DEFAULT_SUMMARY_PROMPT = `你是一个工作内容分析师。
以下是用户 "{userName}" 在 {date} 的 {requestCount} 条 AI 请求记录（已截取部分内容）：

{logsText}

请分析这位用户 {date} 的工作内容，以 JSON 格式返回：
{
  "tags": {
    "debugging": <int, 调试/排查问题相关请求数>,
    "documentation": <int, 写文档/注释/说明相关请求数>,
    "code_gen": <int, 代码生成/实现功能相关请求数>,
    "refactor": <int, 重构/优化代码相关请求数>,
    "testing": <int, 测试/写测试用例相关请求数>,
    "other": <int, 以上无法归类的请求数>
  },
  "summary": "<自然语言总结，主语用'该用户'，包含主要工作主题、产出和关键成果>"
}
注意：
- tags 各项之和不需要严格等于总请求数，按实际分类估算即可
- summary 不要列出具体对话内容，只总结工作主题和成果
- summary 字数约 500 字以内
- 存在多项工作分点列出并换行显示
- 只输出 JSON，不要有任何其他文字`;

export interface RunResult {
  dateStr: string;
  total: number;
  ok: number;
  failed: number;
  failureReason?: string;
  failedUsers?: Array<{ userName: string; reason: string }>;
}

/** 系统时区下"昨天"的日历日期字符串（YYYY-MM-DD）。用 Intl 取"今天"再退一天，避免 DST 误差。 */
function getYesterdayDateStrInTimezone(timezone: string): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  // 锚定 UTC 正午再减一天，规避午夜前后跨 DST 边界导致的日期偏移
  const asUtcNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  asUtcNoon.setUTCDate(asUtcNoon.getUTCDate() - 1);
  const yy = asUtcNoon.getUTCFullYear();
  const mm = String(asUtcNoon.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(asUtcNoon.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * 给定业务日期（系统时区下的日历日）与时区，构造该日历日在 UTC 时间戳上的
 * [start, end) 区间条件，用法与 repository/leaderboard.ts 的 buildDateCondition 一致。
 */
function buildDayRangeCondition(dateStr: string, timezone: string) {
  const startLocal = sql`(${dateStr}::date)::timestamp`;
  const endExclusiveLocal = sql`((${dateStr}::date) + INTERVAL '1 day')`;
  return {
    start: sql`(${startLocal} AT TIME ZONE ${timezone})`,
    endExclusive: sql`(${endExclusiveLocal} AT TIME ZONE ${timezone})`,
  };
}

function buildPrompt(
  userName: string,
  date: string,
  requestCount: number,
  logs: Array<{ requestBody: string | null; responseBody: string | null }>,
  template?: string | null
): string {
  const MAX_BODY_LEN = 500;
  const MAX_LOG_ENTRIES = 100;

  const logsText = logs
    .slice(0, MAX_LOG_ENTRIES)
    .map((l, i) => {
      const req = l.requestBody?.slice(0, MAX_BODY_LEN) ?? "(empty)";
      const res = l.responseBody?.slice(0, MAX_BODY_LEN) ?? "(empty)";
      return `--- 请求 ${i + 1} ---\n[用户输入]: ${req}\n[AI输出]: ${res}`;
    })
    .join("\n\n");

  return (template || DEFAULT_SUMMARY_PROMPT)
    .replace(/\{userName\}/g, userName)
    .replace(/\{date\}/g, date)
    .replace(/\{requestCount\}/g, String(requestCount))
    .replace(/\{logsText\}/g, logsText);
}

export async function runDailyWorkSummary(options?: { dateOverride?: string }): Promise<RunResult> {
  const timezone = await resolveSystemTimezone();
  const dateStr =
    options?.dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(options.dateOverride)
      ? options.dateOverride
      : getYesterdayDateStrInTimezone(timezone);
  const { start, endExclusive } = buildDayRangeCondition(dateStr, timezone);

  logger.info("[DailyWorkSummary] Starting", { dateStr, timezone });

  const settings = await getSystemSettings().catch(() => null);
  const promptTemplate = settings?.dailySummaryPrompt ?? null;

  // 加载分组配置；若无分组，则回退到内置双层瀑布
  const configuredGroups = await getDailySummaryGroups().catch(() => []);
  const activeGroups = configuredGroups.filter((g) => g.enabled);

  // 兜底：无分组配置时使用内置 Claude → Codex 两层
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

  // 拉取昨日所有有 userName 的 io-log 记录（日历日边界按系统配置时区计算，与 leaderboard 查询口径一致）
  const rows = await db
    .select({
      userName: requestIoLog.userName,
      requestBody: requestIoLog.requestBody,
      responseBody: requestIoLog.responseBody,
    })
    .from(requestIoLog)
    .where(
      and(
        sql`${requestIoLog.createdAt} >= ${start}`,
        sql`${requestIoLog.createdAt} < ${endExclusive}`,
        isNotNull(requestIoLog.userName)
      )
    );

  if (rows.length === 0) {
    logger.info("[DailyWorkSummary] No io-log rows for date", { dateStr });
    return { dateStr, total: 0, ok: 0, failed: 0 };
  }

  // 按 userName 分组
  const byUser = new Map<string, typeof rows>();
  for (const row of rows) {
    const name = row.userName!;
    if (!byUser.has(name)) byUser.set(name, []);
    byUser.get(name)!.push(row);
  }

  // 并行为每个用户生成总结
  const userEntries = Array.from(byUser.entries());

  const perUserResults = await Promise.all(
    userEntries.map(
      async ([userName, userLogs]): Promise<{ ok: boolean; userName: string; reason?: string }> => {
        try {
          const requestCount = userLogs.length;
          const prompt = buildPrompt(userName, dateStr, requestCount, userLogs, promptTemplate);
          let lastError: string | undefined;

          for (const tier of tiers) {
            const excludedIds: number[] = [];
            // 分组有 groupTag 时按 groupTag 筛选；否则使用内置类型列表（仅兜底路径）
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
                await upsertDailyWorkSummary({
                  userName,
                  date: dateStr,
                  requestCount,
                  summary: result.result.data,
                  providerId: provider.id,
                  model: result.result.model,
                  inputTokens: result.result.inputTokens,
                  outputTokens: result.result.outputTokens,
                });
                logger.info("[DailyWorkSummary] User done", {
                  userName,
                  dateStr,
                  requestCount,
                  tier: tier.name,
                  providerType: provider.providerType,
                });
                return { ok: true as const, userName };
              }

              lastError = formatLlmError(result.error);
              excludedIds.push(provider.id);
              logger.warn("[DailyWorkSummary] Provider failed, trying next", {
                userName,
                dateStr,
                providerId: provider.id,
                tier: tier.name,
                reason: lastError,
              });
            }
          }

          logger.error("[DailyWorkSummary] All providers exhausted", { userName, dateStr });
          return { ok: false as const, userName, reason: lastError ?? "all providers exhausted" };
        } catch (error) {
          const reason = `unexpected: ${error instanceof Error ? error.message : String(error)}`;
          logger.error("[DailyWorkSummary] Unexpected error for user", {
            userName,
            dateStr,
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

  const result: RunResult = {
    dateStr,
    total: byUser.size,
    ok: okCount,
    failed: failedUsers.length,
    failedUsers: failedUsers.length > 0 ? failedUsers : undefined,
  };
  logger.info("[DailyWorkSummary] Done", result);
  return result;
}
