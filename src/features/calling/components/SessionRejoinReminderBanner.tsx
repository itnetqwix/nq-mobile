import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { navigationRef } from "../../../navigation/navigationRef";
import { haptics } from "../../../lib/haptics";
import { radii, space, typography, useThemedStyles, useThemeColors } from "../../../theme";
import { fetchSessionDepartureStatus } from "../../home/api/homeApi";
import { useAuth } from "../../auth/context/AuthContext";

type Props = {
  sessionId: string;
  partnerName?: string;
};

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Off-meeting reminder for the departed leaver when partner chose to stay.
 * Polls departure status on dashboard / session cards.
 */
export function SessionRejoinReminderBanner({ sessionId, partnerName }: Props) {
  const c = useThemeColors();
  const styles = useStyles();
  const { user } = useAuth();
  const myUserId = String((user as { _id?: string })?._id ?? "");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!sessionId || !myUserId || dismissed) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetchSessionDepartureStatus(sessionId);
        const dep = res?.departure;
        if (cancelled || !dep) return;

        const isDepartedLeaver =
          dep.initiatedByUserId && String(dep.initiatedByUserId) === myUserId;
        const partnerStayed = !!dep.stayedActiveAt && !dep.pendingForUserId;

        if (!isDepartedLeaver || !partnerStayed || dep.bookedEndAt == null) {
          setVisible(false);
          return;
        }

        const bookedEndMs = new Date(dep.bookedEndAt).getTime();
        if (Date.now() >= bookedEndMs) {
          setVisible(false);
          return;
        }

        const deadline = dep.rejoinDeadlineAt
          ? new Date(dep.rejoinDeadlineAt).getTime()
          : null;
        if (deadline) {
          setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
        }
        setVisible(true);
      } catch {
        /* noop */
      }
    };

    void poll();
    const id = setInterval(() => void poll(), 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sessionId, myUserId, dismissed]);

  useEffect(() => {
    if (secondsLeft == null || secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s != null && s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  if (!visible || dismissed) return null;

  const handleRejoin = () => {
    haptics.tap();
    if (navigationRef.isReady()) {
      navigationRef.navigate("Meeting", { lessonId: sessionId, skipLobby: true });
    }
  };

  return (
    <Pressable
      onPress={handleRejoin}
      style={[styles.banner, { borderColor: c.brandNavy, backgroundColor: `${c.brandNavy}14` }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: c.brandNavy }]}>
        <Ionicons name="time-outline" size={14} color={c.brandTextOn} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: c.text }]}>Partner stayed in session</Text>
        <Text style={[styles.body, { color: c.textMuted }]}>
          {partnerName ?? "Your partner"} is still in the lesson.
          {secondsLeft != null && secondsLeft > 0
            ? ` Rejoin in ${formatCountdown(secondsLeft)}.`
            : " You can still rejoin before the booked end time."}
        </Text>
      </View>
      <Pressable onPress={() => setDismissed(true)} hitSlop={6}>
        <Ionicons name="close" size={16} color={c.textMuted} />
      </Pressable>
    </Pressable>
  );
}

function useStyles() {
  return useThemedStyles(() =>
    StyleSheet.create({
      banner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: space.sm,
        paddingVertical: 10,
        borderRadius: radii.md,
        borderWidth: 1,
        marginBottom: space.sm,
      },
      iconWrap: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
      },
      title: { ...typography.bodySm, fontWeight: "800" },
      body: { ...typography.caption, marginTop: 2 },
    })
  );
}
