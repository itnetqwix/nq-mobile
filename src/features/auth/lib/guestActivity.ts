import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { getTrainerId } from "../../bookexpert/lib/trainerUtils";
import {
  clearAllGuestData,
  GUEST_STORAGE_KEYS,
  readGuestJson,
  trimByTimestamp,
  writeGuestJson,
} from "./guestStorage";

type StoredGuestFavorite = { _id?: string };

async function readGuestFavoriteIds(): Promise<string[]> {
  const rows = await readGuestJson<StoredGuestFavorite[]>(
    GUEST_STORAGE_KEYS.favoriteTrainers,
    []
  );
  return rows
    .map((row) => String(row._id ?? ""))
    .filter((id) => id.length > 0);
}

/**
 * Tracks what a guest looked at — viewed trainers, searches, favorites — and
 * replays the list to the backend the moment they sign up so the home feed
 * can show "Coaches you were checking out" instead of a cold start.
 *
 * Everything is best-effort: storage failures and an unimplemented backend
 * endpoint both fall back to a silent no-op, never blocking the user.
 */

const MAX_VIEWED = 50;
const MAX_SEARCHES = 30;
const VIEW_DEDUPE_WINDOW_MS = 1000 * 60 * 30;

type ViewedRow = { id: string; t: number };
type SearchRow = { q: string; t: number };
type FavoriteRow = { id: string; t: number };

type EventKind = "view" | "search" | "favorite";

type Event = {
  kind: EventKind;
  ref: string;
  t: number;
};

export async function recordTrainerView(
  trainer: Record<string, unknown> | null | undefined
): Promise<void> {
  if (!trainer) return;
  const id = getTrainerId(trainer);
  if (!id) return;
  const now = Date.now();

  const list = await readGuestJson<ViewedRow[]>(
    GUEST_STORAGE_KEYS.recentlyViewedTrainers,
    []
  );

  const recent = list.find(
    (row) => row.id === id && now - row.t < VIEW_DEDUPE_WINDOW_MS
  );
  if (recent) return;

  const next = trimByTimestamp([{ id, t: now }, ...list.filter((r) => r.id !== id)], MAX_VIEWED);
  await writeGuestJson(GUEST_STORAGE_KEYS.recentlyViewedTrainers, next);
  await appendEvent({ kind: "view", ref: id, t: now });
}

export async function recordGuestSearch(query: string): Promise<void> {
  const q = (query ?? "").trim().toLowerCase();
  if (q.length < 2) return;
  const now = Date.now();
  const list = await readGuestJson<SearchRow[]>(
    GUEST_STORAGE_KEYS.recentSearches,
    []
  );
  if (list[0]?.q === q) return;
  const next = trimByTimestamp([{ q, t: now }, ...list.filter((r) => r.q !== q)], MAX_SEARCHES);
  await writeGuestJson(GUEST_STORAGE_KEYS.recentSearches, next);
  await appendEvent({ kind: "search", ref: q, t: now });
}

export async function recordGuestFavoriteEvent(trainerId: string): Promise<void> {
  if (!trainerId) return;
  await appendEvent({ kind: "favorite", ref: trainerId, t: Date.now() });
}

async function appendEvent(event: Event): Promise<void> {
  const list = await readGuestJson<Event[]>(GUEST_STORAGE_KEYS.activityEvents, []);
  const next = trimByTimestamp([event, ...list], 200);
  await writeGuestJson(GUEST_STORAGE_KEYS.activityEvents, next);
}

export type ReplayPayload = {
  viewed: ViewedRow[];
  searches: SearchRow[];
  favorites: FavoriteRow[];
  events: Event[];
};

export async function buildReplayPayload(): Promise<ReplayPayload> {
  const [viewed, searches, events] = await Promise.all([
    readGuestJson<ViewedRow[]>(GUEST_STORAGE_KEYS.recentlyViewedTrainers, []),
    readGuestJson<SearchRow[]>(GUEST_STORAGE_KEYS.recentSearches, []),
    readGuestJson<Event[]>(GUEST_STORAGE_KEYS.activityEvents, []),
  ]);
  const favorites: FavoriteRow[] = events
    .filter((e) => e.kind === "favorite")
    .map((e) => ({ id: e.ref, t: e.t }));
  return { viewed, searches, favorites, events };
}

/**
 * Sends the guest's local activity to the backend so it can seed the new
 * account's recommendations. Failures are swallowed; an unimplemented
 * endpoint just leaves the local data intact for a later retry.
 */
export async function replayGuestData(): Promise<{
  delivered: boolean;
  favoritesReplayed: number;
}> {
  /**
   * Favorites first — they map cleanly onto the existing favorites endpoint,
   * so this lights up even before the broader recommendations endpoint
   * exists server-side.
   */
  const favoriteIds = await readGuestFavoriteIds();
  let favoritesReplayed = 0;
  if (favoriteIds.length > 0) {
    await Promise.all(
      favoriteIds.map(async (id) => {
        try {
          await apiClient.post(
            API_ROUTES.trainee.favoriteTrainer(id),
            undefined,
            { _skipAuthSignOut: true }
          );
          favoritesReplayed += 1;
        } catch {
          /* a trainer the user hearted may no longer exist — skip silently */
        }
      })
    );
  }

  const payload = await buildReplayPayload();
  const hasData =
    payload.viewed.length > 0 ||
    payload.searches.length > 0 ||
    payload.favorites.length > 0;
  if (!hasData) {
    await clearAllGuestData();
    return { delivered: true, favoritesReplayed };
  }
  try {
    await apiClient.post(
      API_ROUTES.trainee.guestActivity,
      payload,
      { _skipAuthSignOut: true }
    );
    await clearAllGuestData();
    return { delivered: true, favoritesReplayed };
  } catch {
    /**
     * Server may not implement the recommendations endpoint yet — still
     * clear the local cache so we don't accumulate stale data forever.
     */
    await clearAllGuestData();
    return { delivered: false, favoritesReplayed };
  }
}
