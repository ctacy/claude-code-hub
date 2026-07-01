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
 * Remove injected XML tag blocks from user message text before storage.
 * Strips patterns like <system-reminder>…</system-reminder> so only the
 * user's actual words are persisted.
 */
function stripXmlTagBlocks(text: string): string {
  // If the message is a slash command invocation, keep only the command name
  const commandName = /<command-name>([\s\S]*?)<\/command-name>/.exec(text);
  if (commandName) return commandName[1].trim();

  return text
    .replace(/<[a-zA-Z][a-zA-Z0-9-]*(?:\s[^>]*)?>[\s\S]*?<\/[a-zA-Z][a-zA-Z0-9-]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract the last user-role message text from the request body.
 * Handles both string content and content-block arrays.
 */
function extractLastUserMessage(message: Record<string, unknown>): string | null {
  // Anthropic / OpenAI-chat format: messages[]
  // Responses API (Codex / gpt-5.x) format: input[]
  const list = Array.isArray(message.messages)
    ? message.messages
    : Array.isArray(message.input)
      ? message.input
      : null;
  if (!list) {
    // Responses API may also send `input` as a plain string
    if (typeof message.input === "string") return message.input;
    return null;
  }

  for (let i = list.length - 1; i >= 0; i--) {
    const msg = list[i] as Record<string, unknown>;
    if (msg.role !== "user") continue;

    const content = msg.content;
    if (typeof content === "string") return content;

    if (Array.isArray(content)) {
      const texts = content
        .filter(
          (c): c is { type: string; text: string } =>
            typeof c === "object" &&
            c !== null &&
            // Anthropic: type "text"; Responses API: type "input_text"
            ((c as Record<string, unknown>).type === "text" ||
              (c as Record<string, unknown>).type === "input_text") &&
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

  // Responses API SSE path (Codex / gpt-5.x): response.output_text.delta
  if (responseText.includes("response.output_text.delta")) {
    const texts: string[] = [];
    for (const line of responseText.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
        if (data.type === "response.output_text.delta" && typeof data.delta === "string") {
          texts.push(data.delta);
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

  // Method A: skip if request carries X-No-Log header (any truthy value)
  if (session.headers.get("x-no-log")) return;

  const rawMessage = session.request.message as Record<string, unknown> | null;

  // Method B: skip if any part of the request body contains the [no-log] marker
  if (rawMessage && JSON.stringify(rawMessage).includes("[no-log]")) return;
  const rawUserMessage = rawMessage ? extractLastUserMessage(rawMessage) : null;
  // Strip injected XML tag blocks (e.g. <system-reminder>…</system-reminder>) before storage
  const userMessage = rawUserMessage ? stripXmlTagBlocks(rawUserMessage) : null;
  const assistantText = extractAssistantText(responseText);

  insertRequestIoLog({
    requestId,
    requestBody: userMessage ?? null,
    responseBody: assistantText || null,
    userName: session.userName ?? null,
    keyName: session.authState?.key?.name ?? null,
  }).catch((err) => {
    logger.warn("[IoLog] Failed to persist request I/O log", {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}
