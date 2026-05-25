/**
 * Persistent storage for AI Assistant chat transcripts.
 *
 * Why we need this:
 *   - The assistant currently resets the conversation every time the
 *     user closes the screen, which is jarring and forces the user to
 *     re-explain context they already shared.
 *   - We persist by-user (so two accounts on the same device don't see
 *     each other's history) and trim aggressively (max 200 messages
 *     and `MAX_AGE_DAYS` retention) so the record stays small and the
 *     model context stays focused.
 *
 * Storage:
 *   - We use `expo-secure-store` because chat content may include
 *     personal data; the same store backs other PII like the coach-mark
 *     "seen" map and 2FA challenge state.
 *   - On platforms where SecureStore size limits matter (>2 KB on iOS),
 *     we fall back to a noop persistence so the app never crashes. The
 *     in-memory transcript still works for the active session.
 */

import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "nq.ai-assistant.history.v1";
const MAX_MESSAGES = 200;
const MAX_AGE_DAYS = 30;

export type StoredAiRole = "user" | "assistant";

export type StoredAiMessage = {
  id: string;
  role: StoredAiRole;
  content: string;
  /** ms since epoch */
  ts: number;
};

type Bag = Record<string, StoredAiMessage[]>;

function sanitiseKey(userId: string | null | undefined): string {
  if (!userId) return "anon";
  /** SecureStore keys can be anything ASCII — we just guard against
   *  empty strings so the bucket map stays addressable. */
  return userId.trim() || "anon";
}

async function readBag(): Promise<Bag> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Bag) : {};
  } catch {
    return {};
  }
}

async function writeBag(bag: Bag): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(bag));
  } catch {
    /** Persistence is best-effort — in-memory state still flows. */
  }
}

function prune(messages: StoredAiMessage[]): StoredAiMessage[] {
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const filtered = messages.filter(
    (m) => typeof m.ts === "number" && m.ts > cutoff && typeof m.content === "string"
  );
  return filtered.slice(-MAX_MESSAGES);
}

export async function loadAiHistory(userId: string | null | undefined): Promise<StoredAiMessage[]> {
  const bag = await readBag();
  const slice = bag[sanitiseKey(userId)] ?? [];
  return prune(slice);
}

export async function appendAiMessage(
  userId: string | null | undefined,
  msg: StoredAiMessage
): Promise<void> {
  const bag = await readBag();
  const key = sanitiseKey(userId);
  bag[key] = prune([...(bag[key] ?? []), msg]);
  await writeBag(bag);
}

export async function setAiHistory(
  userId: string | null | undefined,
  messages: StoredAiMessage[]
): Promise<void> {
  const bag = await readBag();
  const key = sanitiseKey(userId);
  bag[key] = prune(messages);
  await writeBag(bag);
}

export async function clearAiHistory(userId: string | null | undefined): Promise<void> {
  const bag = await readBag();
  const key = sanitiseKey(userId);
  if (!(key in bag)) return;
  delete bag[key];
  await writeBag(bag);
}
