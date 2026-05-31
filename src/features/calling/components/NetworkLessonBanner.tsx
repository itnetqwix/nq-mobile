import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { meetingTheme } from "../meetingTheme";
import { clipsMayLagMessage } from "../lessonNetworkTier";
import type { LessonNetworkMode } from "../hooks/useAdaptiveLessonNetwork";

type Props = {
  mode: LessonNetworkMode;
  videoPausedForNetwork: boolean;
  partnerQualityLabel?: string | null;
  usingRelay?: boolean;
  onTurnVideoBackOn?: () => void;
  topOffset?: number;
};

/**
 * Meet/Zoom-style strip when the link is slow or offline. Audio can continue;
 * video may be paused locally to save data.
 */
export function NetworkLessonBanner({
  mode,
  videoPausedForNetwork,
  partnerQualityLabel,
  usingRelay,
  onTurnVideoBackOn,
  topOffset = 108,
}: Props) {
  if (mode === "normal" && !videoPausedForNetwork && !partnerQualityLabel) {
    return null;
  }

  const isOffline = mode === "offline";
  const isSlow = mode === "slow" || mode === "fair" || isOffline;

  let title = "Slow connection";
  let body =
    "We're keeping your lesson going. Audio stays on; video may pause to save data.";

  if (isOffline) {
    title = "No internet";
    body =
      "Reconnect when you can — your lesson timer won't stop for brief drops, but video needs a connection.";
  } else if (videoPausedForNetwork) {
    title = "Video paused to save data";
    body =
      "Your camera was turned off because the connection is weak. Tap below when your network is better.";
  } else if (partnerQualityLabel && partnerQualityLabel.toLowerCase().includes("weak")) {
    title = "Partner connection is weak";
    body = `Their link looks unstable (${partnerQualityLabel}). Clips and audio should still work.`;
  }

  const clipsHint = clipsMayLagMessage(mode);
  if (clipsHint && !videoPausedForNetwork && !isOffline) {
    body = `${body} ${clipsHint}`;
  }
  if (usingRelay) {
    body = `${body} Using relay server — video may use more data.`;
  }

  return (
    <View style={[styles.wrap, { top: topOffset }]} pointerEvents="box-none">
      <View style={[styles.card, isOffline && styles.cardOffline]}>
        <Ionicons
          name={isOffline ? "cloud-offline-outline" : "speedometer-outline"}
          size={20}
          color={isOffline ? "#fecaca" : "#fde68a"}
        />
        <View style={styles.textCol}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          {videoPausedForNetwork && onTurnVideoBackOn ? (
            <Pressable style={styles.cta} onPress={onTurnVideoBackOn}>
              <Text style={styles.ctaText}>Turn camera back on</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 22,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(120, 53, 15, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(253, 224, 71, 0.35)",
  },
  cardOffline: {
    backgroundColor: "rgba(127, 29, 29, 0.92)",
    borderColor: "rgba(248, 113, 113, 0.35)",
  },
  textCol: { flex: 1, gap: 4 },
  title: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  body: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 12,
    lineHeight: 17,
  },
  cta: {
    marginTop: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: meetingTheme.navy,
  },
  ctaText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
