/**
 * Pre-class checklist sheet — fires ~5 min before a scheduled lesson and
 * walks the user through a "get ready" list. Only shows once per session
 * (key is persisted) so closing the app and reopening doesn't nag again.
 *
 * Why it exists:
 *   - First-session anxiety + tech issues are the #1 reason trainees
 *     no-show or join late. A checklist 5 min out catches camera/mic
 *     permissions before the trainer is waiting.
 *   - Friction reduction: "do you have water / quiet space?" cues
 *     non-tech aspects that improve lesson quality and review scores.
 *
 * Lifecycle:
 *   - Hooked into the dashboard's upcoming-sessions query.
 *   - Computes the next upcoming session within `[0, 15] min` of start.
 *   - When the user is within `WINDOW_MS` we check the dismissed-map and
 *     pop the sheet. Dismissal is persisted by session id.
 *   - The visible-window also closes the sheet if the user joined the
 *     lesson (server stamps `start_time` / `both_joined_at`).
 */

import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Sheet } from "../../../components/ui";
import { radii, space, typography, useThemeColors } from "../../../theme";
import {
  getSessionStart,
  isSessionInProgress,
  normalizeSessionStatus,
} from "../../../lib/sessions/sessionUtils";

const DISMISSED_KEY = "nq.preclass-checklist.dismissed.v1";

/** Fire when the next session is within this many minutes. */
const WINDOW_MIN = 0;
const WINDOW_MAX = 5;

type SessionLike = Record<string, unknown> & { _id?: string; id?: string };

export type PreClassChecklistSheetProps = {
  /** Active upcoming sessions feed (already filtered to the user's bookings). */
  sessions: SessionLike[] | undefined;
  /** Tick the sheet every minute. Caller is responsible for the interval. */
  tick?: number;
  /** Called when the user taps "Open camera/mic test". */
  onRunMediaCheck?: () => void;
  /** Called when the user taps "Join now" — usually navigates to the
   *  meeting / lobby. */
  onJoin?: (session: SessionLike) => void;
};

type ChecklistItem = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  /** Whether the user has checked it off (transient, per-render). */
  done: boolean;
};

function readDismissedMap(): Promise<Record<string, number>> {
  return SecureStore.getItemAsync(DISMISSED_KEY)
    .then((raw) => {
      if (!raw) return {} as Record<string, number>;
      try {
        return JSON.parse(raw) as Record<string, number>;
      } catch {
        return {} as Record<string, number>;
      }
    })
    .catch(() => ({} as Record<string, number>));
}

async function markDismissed(sessionId: string): Promise<void> {
  const map = await readDismissedMap();
  map[sessionId] = Date.now();
  /** Prune entries older than 24h so the file doesn't grow indefinitely. */
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const k of Object.keys(map)) {
    if (map[k] < cutoff) delete map[k];
  }
  try {
    await SecureStore.setItemAsync(DISMISSED_KEY, JSON.stringify(map));
  } catch {
    /* non-critical */
  }
}

function pickNextSession(
  sessions: SessionLike[] | undefined,
  now: number
): { session: SessionLike; minutesUntilStart: number } | null {
  if (!sessions || sessions.length === 0) return null;
  let best: { session: SessionLike; ms: number } | null = null;
  for (const s of sessions) {
    if (isSessionInProgress(s)) continue;
    const status = normalizeSessionStatus(
      (s as { status?: string | null })?.status ?? null
    );
    if (status !== "confirmed" && status !== "accepted" && status !== "upcoming") continue;
    const start = getSessionStart(s);
    if (!start) continue;
    const ms = start.getTime() - now;
    if (ms < 0) continue;
    if (best === null || ms < best.ms) best = { session: s, ms };
  }
  if (!best) return null;
  return { session: best.session, minutesUntilStart: best.ms / 60_000 };
}

export function PreClassChecklistSheet({
  sessions,
  tick: externalTick,
  onRunMediaCheck,
  onJoin,
}: PreClassChecklistSheetProps) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<SessionLike | null>(null);
  const [dismissedMap, setDismissedMap] = useState<Record<string, number>>({});
  const [internalTick, setInternalTick] = useState(0);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    void readDismissedMap().then((m) => {
      if (mounted) setDismissedMap(m);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    /** Self-tick every 30 s when the caller doesn't pass one in. */
    if (externalTick != null) return;
    const id = setInterval(() => setInternalTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [externalTick]);

  const candidate = useMemo(
    () => pickNextSession(sessions, Date.now()),
    [sessions, externalTick, internalTick]
  );

  useEffect(() => {
    if (!candidate) {
      if (open) setOpen(false);
      return;
    }
    const sid = String(candidate.session._id ?? candidate.session.id ?? "");
    if (!sid) return;

    const inWindow =
      candidate.minutesUntilStart >= WINDOW_MIN && candidate.minutesUntilStart <= WINDOW_MAX;
    if (!inWindow) {
      if (open && target && String(target._id ?? target.id) === sid) setOpen(false);
      return;
    }
    if (dismissedMap[sid]) return;

    setTarget(candidate.session);
    setOpen(true);
  }, [candidate, dismissedMap, open, target]);

  const closeAndDismiss = useCallback(async () => {
    setOpen(false);
    const sid = String(target?._id ?? target?.id ?? "");
    if (!sid) return;
    setDismissedMap((prev) => ({ ...prev, [sid]: Date.now() }));
    await markDismissed(sid);
  }, [target]);

  const items = useMemo<ChecklistItem[]>(
    () => [
      {
        id: "camera",
        icon: "videocam-outline",
        title: t("preClass.camera", { defaultValue: "Test your camera" }),
        description: t("preClass.cameraHint", {
          defaultValue: "Open the device camera to confirm it's working and well-lit.",
        }),
        done: !!checked.camera,
      },
      {
        id: "mic",
        icon: "mic-outline",
        title: t("preClass.mic", { defaultValue: "Test your microphone" }),
        description: t("preClass.micHint", {
          defaultValue: "Say a few words — make sure permissions are granted.",
        }),
        done: !!checked.mic,
      },
      {
        id: "quiet",
        icon: "headset-outline",
        title: t("preClass.quiet", { defaultValue: "Find a quiet space" }),
        description: t("preClass.quietHint", {
          defaultValue: "Close the door, mute notifications, use headphones if you can.",
        }),
        done: !!checked.quiet,
      },
      {
        id: "water",
        icon: "water-outline",
        title: t("preClass.water", { defaultValue: "Grab a water bottle" }),
        description: t("preClass.waterHint", {
          defaultValue: "Hydration helps focus, especially for movement sessions.",
        }),
        done: !!checked.water,
      },
      {
        id: "network",
        icon: "wifi-outline",
        title: t("preClass.network", { defaultValue: "Check your Wi-Fi" }),
        description: t("preClass.networkHint", {
          defaultValue: "Move closer to the router or switch off other downloads.",
        }),
        done: !!checked.network,
      },
    ],
    [checked, t]
  );

  const handleToggle = useCallback((id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleMediaCheck = useCallback(() => {
    setChecked((prev) => ({ ...prev, camera: true, mic: true }));
    if (onRunMediaCheck) {
      onRunMediaCheck();
      return;
    }
    /** Fallback for hosts without an in-app media diagnostics screen —
     *  surface the OS settings shortcut so the user can grant
     *  camera/mic perms manually. */
    Linking.openSettings().catch(() => undefined);
  }, [onRunMediaCheck]);

  const handleJoin = useCallback(() => {
    if (target) onJoin?.(target);
    void closeAndDismiss();
  }, [closeAndDismiss, onJoin, target]);

  const minutes = candidate ? Math.max(0, Math.round(candidate.minutesUntilStart)) : 0;

  return (
    <Sheet
      visible={open}
      onClose={closeAndDismiss}
      title={t("preClass.title", { defaultValue: "Your lesson starts soon" })}
      description={t("preClass.description", {
        defaultValue: "Starts in about {{minutes}} min. Quick checklist to make this a smooth one.",
        minutes,
      })}
      showClose
    >
      <View style={{ gap: space.xs }}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => handleToggle(item.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.done }}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: item.done ? c.successSubtle : c.surfaceMuted,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: item.done ? c.success : c.brandAccentSubtle },
              ]}
            >
              <Ionicons
                name={item.done ? "checkmark" : item.icon}
                size={18}
                color={item.done ? "#fff" : c.brandAccent}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[
                  typography.subtitle,
                  {
                    color: c.text,
                    textDecorationLine: item.done ? "line-through" : "none",
                  },
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text style={[typography.caption, { color: c.textMuted }]} numberOfLines={2}>
                {item.description}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={handleMediaCheck}
          style={[styles.secondaryBtn, { borderColor: c.brandAccent }]}
          accessibilityRole="button"
        >
          <Ionicons name="videocam" size={16} color={c.brandAccent} />
          <Text style={[typography.button, { color: c.brandAccent }]}>
            {t("preClass.runMediaCheck", { defaultValue: "Camera & mic check" })}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleJoin}
          style={[styles.primaryBtn, { backgroundColor: c.brandAccent }]}
          accessibilityRole="button"
        >
          <Text style={[typography.button, { color: "#fff" }]}>
            {minutes <= 1
              ? t("preClass.joinNow", { defaultValue: "Join now" })
              : t("preClass.gotIt", { defaultValue: "I'm ready" })}
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.sm,
    borderRadius: radii.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.md,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
