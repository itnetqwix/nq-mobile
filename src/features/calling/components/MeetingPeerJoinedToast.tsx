import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCall } from "../CallContext";
import { meetingTheme } from "../meetingTheme";

/**
 * Lightweight top toast when the partner joins — does not block the video stage.
 */
export function MeetingPeerJoinedToast({ topOffset = 56 }: { topOffset?: number }) {
  const { peerJoined, peer, acknowledgePeerJoined, bothJoined } = useCall();
  const name = peer?.fullname || peer?.fullName || "Your partner";

  useEffect(() => {
    if (bothJoined && peerJoined) {
      acknowledgePeerJoined();
    }
  }, [bothJoined, peerJoined, acknowledgePeerJoined]);

  useEffect(() => {
    if (!peerJoined || bothJoined) return;
    const id = setTimeout(() => acknowledgePeerJoined(), 6000);
    return () => clearTimeout(id);
  }, [peerJoined, bothJoined, acknowledgePeerJoined]);

  if (!peerJoined) return null;

  return (
    <View style={[styles.wrap, { top: topOffset }]} pointerEvents="box-none">
      <Pressable
        style={styles.card}
        onPress={acknowledgePeerJoined}
        accessibilityRole="button"
        accessibilityLabel="Dismiss partner joined message"
      >
        <Ionicons name="checkmark-circle" size={20} color={meetingTheme.success} />
        <View style={styles.textCol}>
          <Text style={styles.title}>{name} joined</Text>
          <Text style={styles.sub}>Your session has started — say hello!</Text>
        </View>
        <Ionicons name="close" size={18} color={meetingTheme.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 35,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: meetingTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: "rgba(22, 163, 74, 0.35)",
    shadowColor: meetingTheme.pipShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  textCol: { flex: 1 },
  title: { fontSize: 14, fontWeight: "700", color: meetingTheme.text },
  sub: { fontSize: 12, color: meetingTheme.textMuted, marginTop: 2 },
});
