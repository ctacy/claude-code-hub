/**
 * 内部 LLM 调用 — 发起请求并解析 JSON 输出
 *
 * 复用 provider-testing 里的 getTestHeaders / getTestUrl / buildProxyUrl，
 * 不走代理会话链路（无 ProxySession / usage_ledger 耦合）。
 * 期望 LLM 返回 JSON schema 格式的工作总结。
 */

import { logger } from "@/lib/logger";
import { getTestHeaders, getTestUrl } from "@/lib/provider-testing/utils/test-prompts";
import type { ProviderType } from "@/types/provider";
import type { PickedProvider } from "./pick-provider";

const INTERNAL_LLM_TIMEOUT_MS = 180_000; // 单次调用最多 180 秒

export interface WorkSummaryJson {
  tags: {
    debugging: number;
    documentation: number;
    code_gen: number;
    refactor: number;
    testing: number;
    other: number;
  };
  summary: string;
}

export interface InternalLlmResult {
  data: WorkSummaryJson;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface InternalLlmError {
  reason: "fetch_failed" | "non_200" | "empty_content" | "parse_failed" | "invalid_structure";
  detail?: string;
  status?: number;
  preview?: string;
}

/**
 * 调用内部 LLM 生成工作总结 JSON。
 * 返回 { ok: true, result } 或 { ok: false, error }。
 */
export async function callInternalLlmForSummary(
  provider: PickedProvider,
  promptText: string,
  modelOverride?: string | null
): Promise<{ ok: true; result: InternalLlmResult } | { ok: false; error: InternalLlmError }> {
  const providerType = (provider.providerType || "claude") as ProviderType;

  const defaultModel = getDefaultModelForType(providerType);
  const model = modelOverride?.trim() || defaultModel;
  const url = getTestUrl(provider.url, providerType, model);
  const headers = getTestHeaders(providerType, provider.key, provider.url);

  const body = buildSummaryRequestBody(providerType, model, promptText);

  let responseText: string;
  let status: number;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(INTERNAL_LLM_TIMEOUT_MS),
    });
    status = response.status;
    responseText = await response.text();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error("[InternalLLM] fetch failed", { providerId: provider.id, error: detail });
    return { ok: false, error: { reason: "fetch_failed", detail } };
  }

  if (status !== 200) {
    const preview = responseText.slice(0, 200);
    logger.error("[InternalLLM] non-200 response", { providerId: provider.id, status, preview });
    return { ok: false, error: { reason: "non_200", status, preview } };
  }

  return parseResponse(responseText, provider.id);
}

function getDefaultModelForType(providerType: ProviderType): string {
  switch (providerType) {
    case "claude":
    case "claude-auth":
      return "claude-opus-4-8";
    case "codex":
    case "openai-compatible":
      return "gpt-5.6-sol";
    case "gemini":
    case "gemini-cli":
      return "gemini-2.5-flash";
    default:
      return "claude-opus-4-8";
  }
}

function buildSummaryRequestBody(
  providerType: ProviderType,
  model: string,
  promptText: string
): Record<string, unknown> {
  const systemMsg =
    "你是一个工作内容分析师。用户给你一批 AI 请求/响应记录，你需要分析工作类型并输出 JSON。只输出 JSON，不要有任何其他文字。";

  if (providerType === "claude" || providerType === "claude-auth") {
    return {
      model,
      max_tokens: 1024,
      stream: false,
      system: systemMsg,
      messages: [{ role: "user", content: promptText }],
    };
  }

  // openai-compatible / codex / gemini fallback
  return {
    model,
    max_tokens: 1024,
    stream: false,
    messages: [
      { role: "system", content: systemMsg },
      { role: "user", content: promptText },
    ],
  };
}

function parseResponse(
  responseText: string,
  providerId: number
): { ok: true; result: InternalLlmResult } | { ok: false; error: InternalLlmError } {
  try {
    const parsed = JSON.parse(responseText) as Record<string, unknown>;

    // 提取 token 用量
    const usage = parsed.usage as Record<string, number> | undefined;
    const inputTokens = usage?.input_tokens ?? usage?.prompt_tokens ?? 0;
    const outputTokens = usage?.output_tokens ?? usage?.completion_tokens ?? 0;
    const model = (parsed.model as string) ?? "";

    // 提取 content 文本
    let contentText = "";
    if (parsed.type === "message" && Array.isArray(parsed.content)) {
      // Anthropic format
      for (const block of parsed.content as Record<string, unknown>[]) {
        if (block.type === "text" && typeof block.text === "string") {
          contentText += block.text;
        }
      }
    } else if (Array.isArray(parsed.choices)) {
      // OpenAI format
      const choice = (parsed.choices as Record<string, unknown>[])[0];
      const msg = choice?.message as Record<string, unknown> | undefined;
      contentText = (msg?.content as string) ?? "";
    } else if (typeof parsed.candidates !== "undefined") {
      // Gemini format (simplified)
      const candidates = parsed.candidates as Record<string, unknown>[];
      const parts = (candidates[0]?.content as Record<string, unknown>)?.parts as Record<
        string,
        unknown
      >[];
      contentText = (parts?.[0]?.text as string) ?? "";
    }

    if (!contentText.trim()) {
      logger.warn("[InternalLLM] empty content in response", { providerId });
      return {
        ok: false,
        error: { reason: "empty_content", preview: responseText.slice(0, 200) },
      };
    }

    // 解析 JSON（有时 LLM 会在 JSON 前后加 markdown 代码块）
    const jsonMatch =
      contentText.match(/```(?:json)?\s*([\s\S]+?)```/) ?? contentText.match(/(\{[\s\S]+\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : contentText.trim();

    const data = JSON.parse(jsonStr) as WorkSummaryJson;

    // 基本结构校验
    if (!data.tags || typeof data.tags !== "object" || typeof data.summary !== "string") {
      logger.warn("[InternalLLM] invalid JSON structure", { providerId, data });
      return {
        ok: false,
        error: {
          reason: "invalid_structure",
          preview: JSON.stringify(data).slice(0, 200),
        },
      };
    }

    // 保证 tags 字段都是数字
    const tags = data.tags;
    (["debugging", "documentation", "code_gen", "refactor", "testing", "other"] as const).forEach(
      (k) => {
        if (typeof tags[k] !== "number") tags[k] = 0;
      }
    );

    return { ok: true, result: { data, inputTokens, outputTokens, model } };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error("[InternalLLM] failed to parse LLM response", { providerId, error: detail });
    return {
      ok: false,
      error: { reason: "parse_failed", detail, preview: responseText.slice(0, 200) },
    };
  }
}
