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
 * Native overlay that sits on top of the embedded meeting WebView. Provides the
 * portrait-calling polish (avatar, peer name, real countdown, end-call button) without
 * duplicating the in-WebView mute / camera controls. When we migrate to a native WebRTC
 * transport, swap this for `PortraitCallChrome` which includes the full action bar.
 */
type Props = {
  peer: CallParticipant;
  countdownLabel: string;
  countdownExpired?: boolean;
  /** Trainee: show extend when timer is low. */
  showExtendButton?: boolean;
  onExtendPress?: () => void;
  /** Trainer: read-only notice when trainee extended. */
  extensionNotice?: string | null;
  /** Tap "X" — confirms before leaving. */
  onLeavePress: () => void;
  /** Tap top-left "↓" — hide the call without leaving (future: minimize to a pill). */
  onMinimize?: () => void;
};

export function PortraitCallOverlay({
  peer,
  countdownLabel,
  countdownExpired,
  showExtendButton,
  onExtendPress,
  extensionNotice,
  onLeavePress,
  onMinimize,
}: Props) {
  const insets = useSafeAreaInsets();
  const name = peer.fullname || peer.fullName || "Coach";
  const avatar = getS3ImageUrl(peer.profile_picture);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatar]);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingTop: insets.top + 4 }]}>
      <View style={styles.bar}>
        <Pressable
          hitSlop={10}
          onPress={onMinimize}
          style={styles.iconBtn}
          disabled={!onMinimize}
        >
          <Ionicons
            name="chevron-down"
            size={20}
            color={onMinimize ? "#fff" : "rgba(255,255,255,0.4)"}
          />
        </Pressable>

        <View style={styles.peerInfo}>
          {avatar && !avatarFailed ? (
            <ImageWithSkeleton
              uri={avatar}
              width={32}
              height={32}
              borderRadius={16}
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
            <View style={styles.timerRow}>
              <View style={styles.liveDot} />
              <Text
                style={[styles.timer, countdownExpired && { color: "#fca5a5" }]}
                numberOfLines={1}
              >
                {countdownExpired
                  ? `Lesson ended · ${countdownLabel}`
                  : `${countdownLabel} left`}
              </Text>
            </View>
          </View>
        </View>

        {showExtendButton && onExtendPress ? (
          <Pressable hitSlop={10} onPress={onExtendPress} style={[styles.iconBtn, styles.iconBtnExtend]}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
          </Pressable>
        ) : null}
        <Pressable hitSlop={10} onPress={onLeavePress} style={[styles.iconBtn, styles.iconBtnLeave]}>
          <Ionicons name="exit-outline" size={20} color="#fff" />
        </Pressable>
      </View>
      {!!extensionNotice && (
        <View style={styles.notice}>
          <Text style={styles.noticeText} numberOfLines={2}>
            {extensionNotice}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  bar: {
    marginHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  iconBtnLeave: { backgroundColor: "#dc2626" },
  iconBtnExtend: { backgroundColor: "#000080" },
  notice: {
    marginHorizontal: 10,
    marginTop: 6,
    backgroundColor: "rgba(0,0,128,0.85)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  noticeText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  peerInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  avatarFallback: {
    backgroundColor: "#000080",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: "#fff", fontWeight: "700", fontSize: 14 },
  peerText: { flex: 1 },
  peerName: { color: "#fff", fontWeight: "700", fontSize: 13 },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  timer: { color: "#cbd5f5", fontSize: 11, fontVariant: ["tabular-nums"] },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22c55e",
  },
});
