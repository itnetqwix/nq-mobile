import type { AxiosError } from "axios";
import { parseAiActions } from "./aiActions";

const POISONED_ASSISTANT_SNIPPETS = [
  "having trouble connecting",
  "temporarily unavailable",
];

/** Drop prior client-side error bubbles so we do not poison the model context. */
export function isPoisonedAssistantContent(content: string): boolean {
  const lower = content.toLowerCase();
  return POISONED_ASSISTANT_SNIPPETS.some((s) => lower.includes(s));
}

export function buildChatHistoryForApi(
  messages: { role: "user" | "assistant"; content: string; id?: string }[]
): { role: "user" | "assistant"; content: string }[] {
  return messages
    .filter((m) => m.id !== "welcome")
    .map((m) => ({ role: m.role, content: m.content.trim() }))
    .filter((m) => m.content.length > 0)
    .filter((m) => m.role !== "assistant" || !isPoisonedAssistantContent(m.content))
    .slice(-10);
}

/**
 * Backend returns `ResponseBuilder` JSON:
 * `{ code, status, result: { reply, actions, message, status } }`
 * Some proxies wrap again under `data`. Accept all shapes.
 */
export function parseChatAssistantPayload(data: unknown): {
  reply: string | null;
  actions: ReturnType<typeof parseAiActions>;
} {
  if (!data || typeof data !== "object") {
    return { reply: null, actions: [] };
  }

  const root = data as Record<string, unknown>;
  const result = root.result;
  const nested =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : null;
  const dataNode =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : null;

  const reply =
    (typeof nested?.reply === "string" && nested.reply) ||
    (typeof dataNode?.reply === "string" && dataNode.reply) ||
    (typeof root.reply === "string" && root.reply) ||
    null;

  const actionsRaw = nested?.actions ?? dataNode?.actions ?? root.actions;
  const actions = parseAiActions(actionsRaw);

  return { reply, actions };
}

/** When axios rejects on HTTP 500, the body may still include a payload. */
export function parseChatAssistantFromAxiosError(err: unknown): {
  reply: string | null;
  actions: ReturnType<typeof parseAiActions>;
} {
  const ax = err as AxiosError;
  if (!ax.response?.data) {
    return { reply: null, actions: [] };
  }
  return parseChatAssistantPayload(ax.response.data);
}
