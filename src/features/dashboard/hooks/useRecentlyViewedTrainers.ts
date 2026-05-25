import { useCallback, useEffect, useState } from "react";
import {
  getRecentTrainers,
  recordRecentTrainer,
  type RecentTrainerRow,
} from "../lib/recentlyViewedTrainers";

/**
 * Read + write the local "recently viewed coaches" cache. Hydrates from
 * AsyncStorage on mount, and exposes a `track()` that callers should fire
 * whenever a trainer card / profile is opened.
 */
export function useRecentlyViewedTrainers(userId: string | null) {
  const [rows, setRows] = useState<RecentTrainerRow[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    void getRecentTrainers(userId).then((list) => {
      if (!alive) return;
      setRows(list);
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const track = useCallback(
    async (trainer: Record<string, unknown> | null | undefined) => {
      await recordRecentTrainer(trainer, userId);
      const fresh = await getRecentTrainers(userId);
      setRows(fresh);
    },
    [userId]
  );

  return { recentTrainers: rows, isHydrated: hydrated, track };
}
