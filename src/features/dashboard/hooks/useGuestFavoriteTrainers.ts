import { useCallback, useEffect, useState } from "react";
import {
  clearGuestJson,
  GUEST_STORAGE_KEYS,
  readGuestJson,
  writeGuestJson,
} from "../../auth/lib/guestStorage";
import { getTrainerId } from "../../bookexpert/lib/trainerUtils";

/**
 * Slimmed-down snapshot of a trainer we persist locally for guests so the
 * heart still shows the right name/avatar even before the directory feed
 * loads. We never send this to the server verbatim — it's purely a cache
 * for offline / pre-sign-in rendering.
 */
type GuestFavoriteRow = Record<string, unknown> & {
  _id: string;
  t: number;
};

function pickSnapshot(trainer: Record<string, unknown>, id: string): GuestFavoriteRow {
  return {
    _id: id,
    fullname: trainer.fullname ?? trainer.fullName ?? trainer.name,
    profile_picture: trainer.profile_picture ?? trainer.avatar,
    category: trainer.category ?? trainer.categories,
    hourly_rate: trainer.hourly_rate,
    avgRating: trainer.avgRating ?? trainer.rating,
    t: Date.now(),
  };
}

/**
 * Lets a signed-out user heart trainers. Stored in AsyncStorage so the list
 * survives app restarts and the eventual sign-up flow — then replayed
 * server-side by `replayGuestData` once the user has an account.
 */
export function useGuestFavoriteTrainers(enabled: boolean) {
  const [favorites, setFavorites] = useState<GuestFavoriteRow[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setHydrated(true);
      return;
    }
    let alive = true;
    void (async () => {
      const stored = await readGuestJson<GuestFavoriteRow[]>(
        GUEST_STORAGE_KEYS.favoriteTrainers,
        []
      );
      if (!alive) return;
      setFavorites(stored);
      setHydrated(true);
    })();
    return () => {
      alive = false;
    };
  }, [enabled]);

  const persist = useCallback((rows: GuestFavoriteRow[]) => {
    setFavorites(rows);
    void writeGuestJson(GUEST_STORAGE_KEYS.favoriteTrainers, rows);
  }, []);

  const isFavorite = useCallback(
    (trainer: Record<string, unknown>) => {
      const id = getTrainerId(trainer);
      if (!id) return false;
      return favorites.some((row) => row._id === id);
    },
    [favorites]
  );

  const toggleFavorite = useCallback(
    (trainer: Record<string, unknown>) => {
      const id = getTrainerId(trainer);
      if (!id) return;
      const exists = favorites.some((row) => row._id === id);
      const next = exists
        ? favorites.filter((row) => row._id !== id)
        : [pickSnapshot(trainer, id), ...favorites];
      persist(next.slice(0, 200));
    },
    [favorites, persist]
  );

  const clear = useCallback(async () => {
    setFavorites([]);
    await clearGuestJson(GUEST_STORAGE_KEYS.favoriteTrainers);
  }, []);

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    isHydrated: hydrated,
    clear,
  };
}
