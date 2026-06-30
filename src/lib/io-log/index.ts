/**
 * Request I/O Logging — fire-and-forget hook
 *
 * Controlled by env ENABLE_IO_BODY_LOGGING (default: false).
 * Stores only the cleaned conversation pair:
 *   request_body  → { user_message: "<last user text>" }
 *   response_body → "<assistant text only>"
 *
 * Tools schemas, system prompts, and SSE event wrappers are stripped.
 */
import type { ProxySession } from "@/app/v1/_lib/proxy/session";
import { getEnvConfig } from "@/lib/config/env.schema";
import { logger } from "@/lib/logger";
import { insertRequestIoLog } from "@/repository/io-log";

// ─── Extraction helpers ────────────────────────────────────────────────────

/**
 * Extract the last user-role message text from the request body.
 * Handles both string content and content-block arrays.
 */
function extractLastUserMessage(message: Record<string, unknown>): string | null {
  const messages = message.messages;
  if (!Array.isArray(messages)) return null;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as Record<string, unknown>;
    if (msg.role !== "user") continue;

    const content = msg.content;
    if (typeof content === "string") return content;

    if (Array.isArray(content)) {
      const texts = content
        .filter(
          (c): c is { type: string; text: string } =>
            typeof c === "object" &&
            c !== null &&
            (c as Record<string, unknown>).type === "text" &&
            typeof (c as Record<string, unknown>).text === "string"
        )
        .map((c) => c.text)
        .join("");
      if (texts) return texts;
    }
  }
  return null;
}

/**
 * Extract plain assistant text from a response.
 * - For SSE streams: accumulate text_delta chunks.
 * - For JSON responses: join content[].text blocks.
 * Falls back to the raw string if neither parses.
 */
function extractAssistantText(responseText: string): string {
  // SSE path: look for content_block_delta / text_delta events
  if (responseText.includes("content_block_delta")) {
    const texts: string[] = [];
    for (const line of responseText.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
        if (
          data.type === "content_block_delta" &&
          typeof data.delta === "object" &&
          data.delta !== null &&
          (data.delta as Record<string, unknown>).type === "text_delta"
        ) {
          const t = (data.delta as Record<string, unknown>).text;
          if (typeof t === "string") texts.push(t);
        }
      } catch {
        // ignore malformed SSE lines
      }
    }
    if (texts.length > 0) return texts.join("");
  }

  // OpenAI SSE path: choices[].delta.content
  if (responseText.includes('"choices"')) {
    const texts: string[] = [];
    for (const line of responseText.split("\n")) {
      if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
      try {
        const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
        const choices = data.choices;
        if (Array.isArray(choices)) {
          for (const c of choices) {
            const delta = (c as Record<string, unknown>).delta as
              | Record<string, unknown>
              | undefined;
            if (typeof delta?.content === "string") texts.push(delta.content);
          }
        }
      } catch {
        // ignore
      }
    }
    if (texts.length > 0) return texts.join("");
  }

  // Non-stream JSON path: content[].text
  try {
    const parsed = JSON.parse(responseText) as Record<string, unknown>;
    const content = parsed.content;
    if (Array.isArray(content)) {
      const text = content
        .filter(
          (c): c is { type: string; text: string } =>
            typeof c === "object" && c !== null && (c as Record<string, unknown>).type === "text"
        )
        .map((c) => c.text)
        .join("");
      if (text) return text;
    }
  } catch {
    // ignore
  }

  // Fallback: return the raw text as-is (already capped at 1MB upstream)
  return responseText;
}

// ─── Public hook ───────────────────────────────────────────────────────────

/**
 * Write the cleaned conversation pair to `request_io_log`.
 *
 * - Guarded by `ENABLE_IO_BODY_LOGGING` env flag (off by default).
 * - Fire-and-forget: never throws, never awaited on the hot path.
 * - Strips tools / system prompt / SSE wrappers before storage.
 *
 * @param session      Proxy session — provides `session.request.message` as input body.
 * @param requestId    `message_request.id` used as the FK reference.
 * @param responseText Full response body (SSE text for streaming, JSON text for non-streaming).
 */
export function fireAndForgetIoLog(
  session: ProxySession,
  requestId: number,
  responseText: string
): void {
  if (!getEnvConfig().ENABLE_IO_BODY_LOGGING) return;

  const rawMessage = session.request.message as Record<string, unknown> | null;
  const userMessage = rawMessage ? extractLastUserMessage(rawMessage) : null;
  const assistantText = extractAssistantText(responseText);

  insertRequestIoLog({
    requestId,
    requestBody: userMessage ?? null,
    responseBody: assistantText || null,
  }).catch((err) => {
    logger.warn("[IoLog] Failed to persist request I/O log", {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}
