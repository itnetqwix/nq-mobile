/**
 * TimeRemaining — RN port of
 * `nq-frontend-main/app/components/portrait-calling/time-remaining.jsx`.
 *
 * Reads `useLessonTimer` (backend-authoritative seconds) and renders a
 * monospace mm:ss pill with the same colour transitions as the web:
 *   > 5 min  → green
 *   1–5 min  → orange
 *   < 1 min  → red
 *
 * Coach (trainer) gets inline Start/Pause/Resume controls. For instant lessons
 * the pause action label flips to "Stop" — same web ux.
 */

import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { LessonTimerStatus } from "../useLessonTimer";

const FIVE_MIN = 5 * 60;
const ONE_MIN = 60;
const ALMOST_DONE = 30;

function format(seconds: number | null): string {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

type Warning = null | "five" | "one" | "thirty";

type Props = {
  remainingSeconds: number | null;
  status: LessonTimerStatus;
  bothUsersJoined: boolean;
  /** True when the displayed value is server-authoritative. When false we're
   *  on the local fallback countdown and show a tiny "syncing…" hint. */
  isAuthoritative?: boolean;
  showCoachControls?: boolean;
  variant?: "scheduled" | "instant";
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  /** Optional callback fired when the timer crosses 5 / 1 / 0.5 minute marks.
   *  Wired by the meeting screen so we can emit in-app notifications. */
  onCrossThreshold?: (key: "five" | "one" | "thirty") => void;
};

export function TimeRemaining({
  remainingSeconds,
  status,
  bothUsersJoined,
  isAuthoritative = true,
  showCoachControls,
  variant = "scheduled",
  onStart,
  onPause,
  onResume,
  onCrossThreshold,
}: Props) {
  const [color, setColor] = useState("#28a745");
  const [warning, setWarning] = useState<Warning>(null);
  const lastSeconds = useRef<number | null>(null);

  useEffect(() => {
    const hasAuth =
      typeof remainingSeconds === "number" && !Number.isNaN(remainingSeconds);
    if (!hasAuth) {
      setColor(bothUsersJoined ? "#28a745" : "#6c757d");
      return;
    }
    const s = Math.max(0, Math.floor(remainingSeconds!));
    if (s > FIVE_MIN) setColor("#28a745");
    else if (s > ONE_MIN) setColor("#ff9800");
    else setColor("#f44336");

    const prev = lastSeconds.current;
    lastSeconds.current = s;
    if (prev != null && prev > FIVE_MIN && s <= FIVE_MIN && s > 0) {
      setWarning("five");
      onCrossThreshold?.("five");
      setTimeout(() => setWarning(null), 5000);
    } else if (prev != null && prev > ONE_MIN && s <= ONE_MIN && s > 0) {
      setWarning("one");
      onCrossThreshold?.("one");
      setTimeout(() => setWarning(null), 5000);
    } else if (prev != null && prev > ALMOST_DONE && s <= ALMOST_DONE && s > 0) {
      setWarning("thirty");
      onCrossThreshold?.("thirty");
      setTimeout(() => setWarning(null), 3000);
    }
  }, [remainingSeconds, bothUsersJoined, onCrossThreshold]);

  const display =
    !bothUsersJoined && remainingSeconds == null && status === "waiting"
      ? "Waiting for both…"
      : format(remainingSeconds);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.pill}>
        <Text style={styles.label}>Time remaining</Text>
        <Text style={[styles.value, { color }]}>{display}</Text>
        {!isAuthoritative && remainingSeconds != null && (
          <Text style={styles.syncHint}>syncing…</Text>
        )}

        {showCoachControls && status === "waiting" && (
          <CoachBtn label="Start" color="#28a745" onPress={onStart} />
        )}
        {showCoachControls && status === "running" && (
          <CoachBtn
            label={variant === "instant" ? "Stop" : "Pause"}
            color={variant === "instant" ? "#d32f2f" : "#ff9800"}
            onPress={onPause}
          />
        )}
        {showCoachControls && status === "paused" && (
          <CoachBtn label="Resume" color="#1e88e5" onPress={onResume} />
        )}
      </View>

      {warning === "five" && (
        <View style={[styles.toast, { backgroundColor: "#1e88e5" }]}>
          <Text style={styles.toastText}>Only 5 minutes left in this session.</Text>
        </View>
      )}
      {warning === "one" && (
        <View style={[styles.toast, { backgroundColor: "#ff9800" }]}>
          <Text style={styles.toastText}>1 minute remaining.</Text>
        </View>
      )}
      {warning === "thirty" && (
        <View style={[styles.toast, { backgroundColor: "#f44336" }]}>
          <Text style={styles.toastText}>Session ending in about 30 seconds.</Text>
        </View>
      )}
    </View>
  );
}

function CoachBtn({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress?: () => void;
}) {
  if (!onPress) return null;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.coachBtn, { backgroundColor: color }]}
      accessibilityRole="button"
    >
      <Text style={styles.coachBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 20,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 30,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  label: {
    fontSize: 13,
    color: "#666",
  },
  value: {
    fontSize: 16,
    fontFamily: "Menlo",
    fontWeight: "700",
    letterSpacing: 1,
  },
  syncHint: {
    fontSize: 11,
    color: "#9aa1ab",
    fontStyle: "italic",
    marginLeft: 4,
  },
  coachBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginLeft: 6,
  },
  coachBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  toast: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  toastText: {
    color: "#fff",
    fontSize: 13,
  },
});
