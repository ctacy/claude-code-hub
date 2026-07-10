/**
 * 内部 LLM 调用 — Provider 随机选取
 *
 * 每次调用时从已启用的 providers 池里随机选一个，
 * 最多重试 3 次（每次排除已失败的）。
 */
import { and, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { providers } from "@/drizzle/schema";
import { logger } from "@/lib/logger";

export interface PickedProvider {
  id: number;
  name: string;
  url: string;
  key: string;
  providerType: string;
}

const MAX_PICK_ATTEMPTS = 3;

/**
 * 随机选取一个可用 provider，失败自动切换。
 *
 * @param excludeIds 已失败 provider id，不再选取
 * @param providerTypes 只选匹配类型的 provider（如 ["claude","claude-auth"]）；空/不传则不限制
 * @returns 可用的 provider，或 null（全部失败）
 */
export async function pickInternalLlmProvider(
  excludeIds: number[] = [],
  providerTypes?: string[]
): Promise<PickedProvider | null> {
  for (let attempt = 0; attempt < MAX_PICK_ATTEMPTS; attempt++) {
    const candidate = await db
      .select({
        id: providers.id,
        name: providers.name,
        url: providers.url,
        key: providers.key,
        providerType: providers.providerType,
      })
      .from(providers)
      .where(
        and(
          sql`${providers.isEnabled} = true`,
          isNull(providers.deletedAt),
          excludeIds.length > 0 ? notInArray(providers.id, excludeIds) : undefined,
          providerTypes && providerTypes.length > 0
            ? sql`${providers.providerType} = ANY(${providerTypes})`
            : undefined
        )
      )
      .orderBy(sql`RANDOM()`)
      .limit(1);

    if (candidate.length === 0) {
      logger.warn("[InternalLLM] No available providers", { attempt, excludeIds });
      return null;
    }

    const provider = candidate[0];
    const pingOk = await pingProvider(provider);
    if (pingOk) {
      return provider as PickedProvider;
    }

    logger.warn("[InternalLLM] Provider ping failed, excluding", {
      providerId: provider.id,
      providerName: provider.name,
      attempt,
    });
    excludeIds = [...excludeIds, provider.id];
  }

  logger.error("[InternalLLM] All provider candidates failed", { excludeIds });
  return null;
}

/**
 * 极简连通性探测：发一个 HEAD 或 GET 到 provider base url，
 * 只检查是否能建立 TCP 连接 + 收到 HTTP 响应（任何状态码均可）。
 * 避免发真实 LLM 请求（有成本）。
 */
async function pingProvider(provider: { url: string }): Promise<boolean> {
  try {
    const pingUrl = provider.url.endsWith("/")
      ? `${provider.url}v1/models`
      : `${provider.url}/v1/models`;

    const response = await fetch(pingUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });
    // 任何 HTTP 响应（包括 401/403）都说明服务可达
    return response.status > 0;
  } catch {
    return false;
  }
}
