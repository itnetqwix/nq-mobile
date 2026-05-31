/**
 * Slow-network UX: detect poor/offline links, reduce bandwidth (tier + optional video off),
 * and surface Meet-style banners. Audio is never auto-muted.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  bucketizeNetworkQuality,
  isPoorNetwork,
  type NetworkStatsSnapshot,
  type QualityBucket,
} from "../callQualityUtils";
import type { LessonNetworkTier } from "../lessonNetworkTier";

export type LessonNetworkMode = LessonNetworkTier;

type Args = {
  enabled: boolean;
  online: boolean;
  cameraEnabled: boolean;
  /** User turned camera off themselves — skip auto video-off. */
  userCameraOffIntent: boolean;
  getNetworkStats: () => Promise<NetworkStatsSnapshot>;
  setCameraPausedForNetwork: (paused: boolean) => void;
  onTierChange?: (tier: LessonNetworkTier) => void;
  pollMsGood?: number;
  pollMsDegraded?: number;
  poorSamplesBeforeVideoOff?: number;
};

const DEFAULT_POOR_SAMPLES = 3;
const MANUAL_VIDEO_OVERRIDE_MS = 120_000;

export function useAdaptiveLessonNetwork({
  enabled,
  online,
  cameraEnabled,
  userCameraOffIntent,
  getNetworkStats,
  setCameraPausedForNetwork,
  onTierChange,
  pollMsGood = 8000,
  pollMsDegraded = 2000,
  poorSamplesBeforeVideoOff = DEFAULT_POOR_SAMPLES,
}: Args) {
  const [mode, setMode] = useState<LessonNetworkMode>("normal");
  const [localBucket, setLocalBucket] = useState<QualityBucket>("unknown");
  const [videoPausedForNetwork, setVideoPausedForNetwork] = useState(false);
  const [usingRelay, setUsingRelay] = useState(false);
  const [appInForeground, setAppInForeground] = useState(
    AppState.currentState === "active"
  );
  const poorStreakRef = useRef(0);
  const manualVideoOverrideUntilRef = useRef(0);
  const pollMsRef = useRef(pollMsGood);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      setAppInForeground(next === "active");
    });
    return () => sub.remove();
  }, []);

  const markManualVideoRestore = useCallback(() => {
    manualVideoOverrideUntilRef.current = Date.now() + MANUAL_VIDEO_OVERRIDE_MS;
    setVideoPausedForNetwork(false);
    setCameraPausedForNetwork(false);
  }, [setCameraPausedForNetwork]);

  useEffect(() => {
    if (!enabled) return;
    if (cameraEnabled && videoPausedForNetwork && !userCameraOffIntent) {
      markManualVideoRestore();
    }
  }, [
    cameraEnabled,
    enabled,
    markManualVideoRestore,
    userCameraOffIntent,
    videoPausedForNetwork,
  ]);

  useEffect(() => {
    onTierChange?.(mode);
  }, [mode, onTierChange]);

  useEffect(() => {
    if (!enabled) {
      setMode("normal");
      setLocalBucket("unknown");
      poorStreakRef.current = 0;
      return;
    }

    if (!online) {
      setMode("offline");
      setLocalBucket("poor");
      poorStreakRef.current = 0;
      pollMsRef.current = pollMsDegraded;
      return;
    }

    const onlineRef = { current: online };
    const foregroundRef = { current: appInForeground };
    onlineRef.current = online;
    foregroundRef.current = appInForeground;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (delay: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void tick(), delay);
    };

    const tick = async () => {
      const stats = await getNetworkStats();
      if (cancelled) return;

      if (!onlineRef.current) {
        setMode("offline");
        schedule(pollMsDegraded);
        return;
      }

      const bucket = bucketizeNetworkQuality(stats);
      setLocalBucket(bucket);
      setUsingRelay(!!stats.usingRelay);

      if (!foregroundRef.current) {
        schedule(pollMsGood);
        return;
      }

      if (isPoorNetwork(stats)) {
        poorStreakRef.current += 1;
        setMode("slow");
        pollMsRef.current = pollMsDegraded;

        const mayAutoOff =
          !userCameraOffIntent &&
          poorStreakRef.current >= poorSamplesBeforeVideoOff &&
          cameraEnabled &&
          Date.now() > manualVideoOverrideUntilRef.current;

        if (mayAutoOff) {
          setCameraPausedForNetwork(true);
          setVideoPausedForNetwork(true);
          poorStreakRef.current = 0;
        }
      } else if (bucket === "fair") {
        poorStreakRef.current = 0;
        setMode("fair");
        pollMsRef.current = pollMsDegraded;
      } else {
        poorStreakRef.current = 0;
        setMode("normal");
        pollMsRef.current = pollMsGood;
      }

      schedule(pollMsRef.current);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    enabled,
    online,
    appInForeground,
    cameraEnabled,
    userCameraOffIntent,
    setCameraPausedForNetwork,
    getNetworkStats,
    pollMsGood,
    pollMsDegraded,
    poorSamplesBeforeVideoOff,
  ]);

  return {
    mode,
    localBucket,
    videoPausedForNetwork,
    markManualVideoRestore,
    usingRelay,
  };
}
