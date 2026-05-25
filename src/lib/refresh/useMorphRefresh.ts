/**
 * `useMorphRefresh` — driver for {@link MorphRefreshHeader}.
 *
 * Returns:
 *   • `scrollProps` — spread onto the underlying scroll surface; wires
 *     `onScroll` to drive the morphing arrow and triggers `onRefresh`
 *     when the user crosses the threshold and releases.
 *   • `headerProps` — pass to `<MorphRefreshHeader />`.
 *   • `refreshing` / `onRefreshControl` — for the system `RefreshControl`,
 *     so list spinners + completion haptics still work.
 *
 * The component contract intentionally separates the morphing visual from
 * the spinner: we keep `RefreshControl` as the source of truth for "is the
 * refetch running" so screens that don't render the morph header still
 * behave correctly.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { haptics } from "../haptics";
import { MORPH_THRESHOLD } from "../../components/ui/MorphRefreshHeader";

export type UseMorphRefreshOptions = {
  /** Async callback that does the actual refetch. */
  onRefresh: () => Promise<unknown> | unknown;
  /** Use native driver — defaults to `true`. */
  useNativeDriver?: boolean;
};

export function useMorphRefresh(opts: UseMorphRefreshOptions) {
  const { onRefresh } = opts;
  const pullValue = useRef(new Animated.Value(0)).current;
  const releasedRef = useRef(false);
  const [released, setReleased] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const inFlightRef = useRef(false);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      pullValue.setValue(Math.min(0, y));

      const crossed = y < -MORPH_THRESHOLD;
      if (crossed && !releasedRef.current) {
        releasedRef.current = true;
        setReleased(true);
        /**
         * Single haptic at the morph moment — matches the visual flip
         * from arrow to check. Subsequent oscillation across the
         * threshold won't re-trigger because `releasedRef` stays set
         * until the gesture ends.
         */
        haptics.tap();
      } else if (!crossed && releasedRef.current && y >= -16) {
        /**
         * User cancelled the pull by dragging back up before letting
         * go — clear the morph state so the next pull starts fresh.
         */
        releasedRef.current = false;
        setReleased(false);
      }
    },
    [pullValue]
  );

  const triggerRefresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setRefreshing(true);
    try {
      await Promise.resolve(onRefresh());
      haptics.success();
    } catch {
      haptics.error();
    } finally {
      setRefreshing(false);
      releasedRef.current = false;
      setReleased(false);
      inFlightRef.current = false;
    }
  }, [onRefresh]);

  /**
   * `RefreshControl` calls `onRefresh` when the user *releases* past its
   * own internal threshold. We piggyback on it for the actual fetch so
   * the spinner stays in lockstep with our state.
   */
  const onRefreshControl = useCallback(() => {
    void triggerRefresh();
  }, [triggerRefresh]);

  useEffect(() => () => {
    pullValue.stopAnimation();
  }, [pullValue]);

  return {
    scrollProps: {
      onScroll,
      scrollEventThrottle: 16,
    },
    headerProps: {
      pullValue,
      released,
    },
    refreshing,
    onRefreshControl,
  };
}
