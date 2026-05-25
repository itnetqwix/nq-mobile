/**
 * `useHapticRefresh` — wraps a refetch function so it plays a haptic
 * tick when the user triggers the gesture and a success/error notification
 * haptic when the refetch resolves.
 *
 * Why a hook instead of dropping `haptics.tap()` everywhere?
 *   - The completion haptic depends on async result — we want to fire
 *     `success` on resolve and `error` on reject without callers having
 *     to instrument their own try/catch.
 *   - It also makes "refreshing" state correct (true while running,
 *     false after the resolved haptic plays) so list refresh spinners
 *     stop in sync with the haptic, which feels considerably better
 *     than the default "spinner snaps off when promise resolves but no
 *     feedback" experience.
 *
 * Usage:
 *   const { refreshing, onRefresh } = useHapticRefresh(refetch);
 *   <FlatList refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} />
 *
 * Or for multi-query screens — pass an async function that awaits them all:
 *   const onRefresh = async () => { await Promise.all([qA.refetch(), qB.refetch()]); };
 *   useHapticRefresh(onRefresh)
 */

import { useCallback, useRef, useState } from "react";
import { haptics } from "../haptics";

export type UseHapticRefreshResult = {
  refreshing: boolean;
  onRefresh: () => Promise<void>;
};

export type UseHapticRefreshOptions = {
  /** Skip the trigger haptic (e.g. when caller already fired one). */
  silentTrigger?: boolean;
  /** Skip the completion haptic. */
  silentCompletion?: boolean;
  /** Fire `warning` instead of `success` on resolve (used when the
   *  underlying fetch can return "nothing changed"). Defaults to `false`. */
  warnOnCompletion?: boolean;
};

export function useHapticRefresh(
  refetch: () => Promise<unknown> | unknown,
  options: UseHapticRefreshOptions = {}
): UseHapticRefreshResult {
  const [refreshing, setRefreshing] = useState(false);
  const inFlightRef = useRef(false);
  const { silentTrigger, silentCompletion, warnOnCompletion } = options;

  const onRefresh = useCallback(async () => {
    /**
     * Guard against double-trigger — RN's RefreshControl is rate-limited
     * but a second `pull` while we're still resolving the first would
     * play two trigger haptics back-to-back, which feels glitchy.
     */
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setRefreshing(true);
    if (!silentTrigger) haptics.tap();

    try {
      await Promise.resolve(refetch());
      if (!silentCompletion) {
        if (warnOnCompletion) haptics.warning();
        else haptics.success();
      }
    } catch {
      if (!silentCompletion) haptics.error();
    } finally {
      setRefreshing(false);
      inFlightRef.current = false;
    }
  }, [refetch, silentCompletion, silentTrigger, warnOnCompletion]);

  return { refreshing, onRefresh };
}
