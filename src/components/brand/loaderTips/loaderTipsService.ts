import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "../../../config/env";
import { fetchMasterRow } from "../../../features/auth/api/masterApi";
import { DEFAULT_LOADER_TIPS } from "./defaultLoaderTips";

const DECK_KEY = "nq.loader-tips.deck";
const REMOTE_KEY = "nq.loader-tips.remote";
const REMOTE_AT_KEY = "nq.loader-tips.remote.at";
const REMOTE_TTL_MS = 6 * 60 * 60 * 1000;

type TipDeckState = {
  version: 1;
  tips: string[];
  order: number[];
  cursor: number;
};

let memoryDeck: TipDeckState | null = null;
let refreshInFlight: Promise<void> | null = null;

function normalizeTipList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const s = item.trim();
    if (s.length < 12 || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function mergeTipPools(...pools: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const pool of pools) {
    for (const tip of pool) {
      if (!seen.has(tip)) {
        seen.add(tip);
        out.push(tip);
      }
    }
  }
  return out;
}

function shuffleOrder(length: number): number[] {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function buildDeck(tips: string[]): TipDeckState {
  const merged = mergeTipPools(tips, [...DEFAULT_LOADER_TIPS]);
  return {
    version: 1,
    tips: merged,
    order: shuffleOrder(merged.length),
    cursor: 0,
  };
}

async function readDeckFromStore(): Promise<TipDeckState | null> {
  try {
    const raw = await SecureStore.getItemAsync(DECK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TipDeckState;
    if (parsed?.version !== 1 || !Array.isArray(parsed.tips) || parsed.tips.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeDeckToStore(deck: TipDeckState): Promise<void> {
  memoryDeck = deck;
  try {
    await SecureStore.setItemAsync(DECK_KEY, JSON.stringify(deck));
  } catch {
    /* non-blocking */
  }
}

function readRemoteTipsUrl(): string | null {
  const raw = (process.env.EXPO_PUBLIC_LOADER_TIPS_URL ?? "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol === "https:" || u.protocol === "http:") return raw;
  } catch {
    /* ignore */
  }
  return null;
}

async function fetchTipsFromRemoteUrl(): Promise<string[]> {
  const url = readRemoteTipsUrl();
  if (!url) return [];

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];
  const body = (await res.json()) as unknown;
  if (Array.isArray(body)) return normalizeTipList(body);
  if (body && typeof body === "object") {
    const tips = (body as { tips?: unknown }).tips;
    return normalizeTipList(tips);
  }
  return [];
}

async function fetchTipsFromMasterRow(): Promise<string[]> {
  const row = await fetchMasterRow();
  if (!row) return [];
  const raw =
    row.loader_tips ??
    row.loaderTips ??
    (row as { loader_tip_texts?: unknown }).loader_tip_texts;
  return normalizeTipList(raw);
}

async function readCachedRemoteTips(): Promise<string[]> {
  try {
    const atRaw = await SecureStore.getItemAsync(REMOTE_AT_KEY);
    const tipsRaw = await SecureStore.getItemAsync(REMOTE_KEY);
    if (!atRaw || !tipsRaw) return [];
    const at = Number(atRaw);
    if (!Number.isFinite(at) || Date.now() - at > REMOTE_TTL_MS) return [];
    return normalizeTipList(JSON.parse(tipsRaw));
  } catch {
    return [];
  }
}

async function cacheRemoteTips(tips: string[]): Promise<void> {
  if (tips.length === 0) return;
  try {
    await SecureStore.setItemAsync(REMOTE_KEY, JSON.stringify(tips));
    await SecureStore.setItemAsync(REMOTE_AT_KEY, String(Date.now()));
  } catch {
    /* non-blocking */
  }
}

async function pullRemoteTips(): Promise<string[]> {
  const pools: string[][] = [];

  try {
    const fromUrl = await fetchTipsFromRemoteUrl();
    if (fromUrl.length > 0) pools.push(fromUrl);
  } catch {
    /* ignore */
  }

  try {
    const fromMaster = await fetchTipsFromMasterRow();
    if (fromMaster.length > 0) pools.push(fromMaster);
  } catch {
    /* ignore — use cache / bundled */
  }

  const merged = mergeTipPools(...pools);
  if (merged.length > 0) {
    await cacheRemoteTips(merged);
    return merged;
  }

  return readCachedRemoteTips();
}

async function ensureDeck(): Promise<TipDeckState> {
  if (memoryDeck && memoryDeck.tips.length > 0) return memoryDeck;

  const stored = await readDeckFromStore();
  if (stored && stored.tips.length > 0) {
    memoryDeck = stored;
    return stored;
  }

  const cachedRemote = await readCachedRemoteTips();
  const deck = buildDeck(cachedRemote);
  await writeDeckToStore(deck);
  return deck;
}

function advanceDeck(deck: TipDeckState): { deck: TipDeckState; tip: string } {
  if (deck.tips.length === 0) {
    return { deck: buildDeck([]), tip: DEFAULT_LOADER_TIPS[0] };
  }

  let { cursor, order, tips } = deck;

  if (order.length !== tips.length) {
    order = shuffleOrder(tips.length);
    cursor = 0;
  }

  if (cursor >= order.length) {
    order = shuffleOrder(tips.length);
    cursor = 0;
  }

  const tip = tips[order[cursor]!] ?? tips[0]!;
  const next: TipDeckState = {
    version: 1,
    tips,
    order,
    cursor: cursor + 1,
  };

  return { deck: next, tip };
}

/** Next tip — cycles through full deck before reshuffling (no immediate repeats). */
export async function getNextLoaderTip(): Promise<string> {
  const deck = await ensureDeck();
  const { deck: nextDeck, tip } = advanceDeck(deck);
  await writeDeckToStore(nextDeck);
  return tip;
}

/** Refresh tips from API / remote JSON (non-blocking). */
export function warmLoaderTipsCache(): void {
  if (refreshInFlight) return;
  refreshInFlight = (async () => {
    try {
      const remote = await pullRemoteTips();
      if (remote.length === 0) return;

      const current = await ensureDeck();
      const merged = mergeTipPools(remote, current.tips, [...DEFAULT_LOADER_TIPS]);
      if (merged.length === current.tips.length) return;

      const deck = buildDeck(merged);
      await writeDeckToStore(deck);
    } finally {
      refreshInFlight = null;
    }
  })();
}

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log("[nq-mobile] loader tips API:", `${API_BASE_URL}/master/master-data`);
}
