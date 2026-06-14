/**
 * MMKV-backed chat message history for offline read.
 * Server remains source of truth; cache is a read fallback when fetch fails offline.
 */

import { readJsonFromMmkv, writeJsonToMmkv } from "../../../lib/storage/mmkvHotStorage";

const STORAGE_PREFIX = "nq.chat.history.v1";
const MAX_CONVERSATIONS = 40;
const MAX_MESSAGES_PER_CONVERSATION = 250;

export type CachedChatMessage = Record<string, unknown>;

type CacheIndex = {
  conversationIds: string[];
};

function indexKey(): string {
  return `${STORAGE_PREFIX}:index`;
}

function conversationKey(conversationId: string): string {
  return `${STORAGE_PREFIX}:${conversationId}`;
}

async function readIndex(): Promise<CacheIndex> {
  return readJsonFromMmkv<CacheIndex>(indexKey(), { conversationIds: [] });
}

async function writeIndex(index: CacheIndex): Promise<void> {
  await writeJsonToMmkv(indexKey(), index);
}

function trimMessages(messages: CachedChatMessage[]): CachedChatMessage[] {
  if (messages.length <= MAX_MESSAGES_PER_CONVERSATION) return messages;
  return messages.slice(-MAX_MESSAGES_PER_CONVERSATION);
}

export async function readCachedChatMessages(
  conversationId: string
): Promise<CachedChatMessage[] | null> {
  if (!conversationId) return null;
  const rows = await readJsonFromMmkv<CachedChatMessage[] | null>(
    conversationKey(conversationId),
    null
  );
  return Array.isArray(rows) && rows.length > 0 ? rows : null;
}

export async function writeCachedChatMessages(
  conversationId: string,
  messages: CachedChatMessage[]
): Promise<void> {
  if (!conversationId || !Array.isArray(messages) || messages.length === 0) return;
  const trimmed = trimMessages(messages);
  await writeJsonToMmkv(conversationKey(conversationId), trimmed);

  const index = await readIndex();
  const without = index.conversationIds.filter((id) => id !== conversationId);
  const nextIds = [conversationId, ...without].slice(0, MAX_CONVERSATIONS);
  const evicted = without.filter((id) => !nextIds.includes(id));
  for (const id of evicted) {
    await writeJsonToMmkv(conversationKey(id), null);
  }
  await writeIndex({ conversationIds: nextIds });
}
