import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ImageWithSkeleton } from "../../../components/ui";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import type { CallParticipant } from "../types";

/**
 * Native portrait-calling chrome that wraps the in-session content (WebView for now,
 * native RTCView later). Provides the same affordances the website `portrait-calling`
 * `action-buttons` + `time-remaining` give the user, but as proper React-Native widgets:
 *
 * - Top bar with peer avatar, name, lesson countdown, and a "minimize" button.
 * - Bottom action bar with End Call (with confirm), Mute, Camera Off, Switch Camera.
 *
 * Toggle state (mute/camera) is purely UI here — the actual mute is performed by the
 * embedded WebView meeting page. When the native transport is wired up, the props
 * `onToggleMute`, `onToggleCamera`, `onSwitchCamera` will gate the real `MediaStreamTrack`.
 */
type Props = {
  peer: CallParticipant;
  countdownLabel: string;
  /** Marks the session as past its scheduled end time — UI emphasises this in red. */
  countdownExpired?: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
  onLeavePress: () => void;
  onMinimize?: () => void;
  /** Wraps the underlying video content (WebView in WebView mode, RTCView in native). */
  children: React.ReactNode;
};

export function PortraitCallChrome({
  peer,
  countdownLabel,
  countdownExpired,
  micEnabled,
  cameraEnabled,
  onToggleMic,
  onToggleCamera,
  onSwitchCamera,
  onLeavePress,
  onMinimize,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const name = peer.fullname || peer.fullName || "Coach";
  const avatar = getS3ImageUrl(peer.profile_picture);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatar]);

  return (
    <View style={styles.root}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        {onMinimize ? (
          <Pressable hitSlop={10} onPress={onMinimize} style={styles.iconBtn}>
            <Ionicons name="chevron-down" size={22} color="#fff" />
          </Pressable>
        ) : (
          <View style={styles.iconBtnPlaceholder} />
        )}
        <View style={styles.peerInfo}>
          {avatar && !avatarFailed ? (
            <ImageWithSkeleton
              uri={avatar}
              width={36}
              height={36}
              borderRadius={18}
              resizeMode="cover"
              style={styles.avatar}
              onLoadError={() => setAvatarFailed(true)}
              accessibilityLabel={`${name} photo`}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{name[0]?.toUpperCase() ?? "?"}</Text>
            </View>
          )}
          <View style={styles.peerText}>
            <Text style={styles.peerName} numberOfLines={1}>
              {name}
            </Text>
            <Text
              style={[
                styles.timer,
                countdownExpired && { color: "#fca5a5" },
              ]}
              numberOfLines={1}
            >
              {countdownExpired ? "Lesson ended · " : ""}
              {countdownLabel}
            </Text>
          </View>
        </View>
        <Pressable hitSlop={10} onPress={onLeavePress} style={styles.iconBtn}>
          <Ionicons name="exit-outline" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Video content (WebView or native) */}
      <View style={styles.contentArea}>{children}</View>

      {/* Bottom action bar */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
        <CircleBtn
          icon={micEnabled ? "mic-outline" : "mic-off-outline"}
          label={micEnabled ? "Mute" : "Unmute"}
          on={micEnabled}
          onPress={onToggleMic}
        />
        <CircleBtn
          icon={cameraEnabled ? "videocam-outline" : "videocam-off-outline"}
          label={cameraEnabled ? "Camera" : "Off"}
          on={cameraEnabled}
          onPress={onToggleCamera}
        />
        <CircleBtn
          icon="camera-reverse-outline"
          label="Flip"
          onPress={onSwitchCamera}
        />
        <CircleBtn
          icon="call"
          label="End"
          onPress={onLeavePress}
          tone="danger"
        />
      </View>
    </View>
  );
}

function CircleBtn({
  icon,
  label,
  onPress,
  on,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  on?: boolean;
  tone?: "danger";
}) {
  const danger = tone === "danger";
  return (
    <Pressable onPress={onPress} style={styles.circleBtnWrap}>
      <View
        style={[
          styles.circleBtn,
          danger && styles.circleBtnDanger,
          on === false && !danger && styles.circleBtnOff,
        ]}
      >
        <Ionicons name={icon} size={22} color="#fff" />
      </View>
      <Text style={styles.circleBtnLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  iconBtnPlaceholder: { width: 36 },
  peerInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" },
  avatarFallback: {
    backgroundColor: "#000080",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: "#fff", fontWeight: "700", fontSize: 15 },
  peerText: { flex: 1 },
  peerName: { color: "#fff", fontWeight: "700", fontSize: 14 },
  timer: { color: "#cbd5f5", fontSize: 12, marginTop: 2, fontVariant: ["tabular-nums"] },

  contentArea: { flex: 1, backgroundColor: "#000" },

  actionBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  circleBtnWrap: { alignItems: "center", gap: 4, width: 64 },
  circleBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  circleBtnOff: { backgroundColor: "rgba(248,113,113,0.35)" },
  circleBtnDanger: { backgroundColor: "#dc2626" },
  circleBtnLabel: { color: "#fff", fontSize: 11, fontWeight: "600" },
});
