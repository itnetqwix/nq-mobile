/**
 * UserBox / UserBoxMini — native RN port of the web
 * `app/components/portrait-calling/user-box.jsx`.
 *
 * `react-native-webrtc` provides `<RTCView />` to render a `MediaStream` ID
 * natively (HW-accelerated). When a stream is unavailable (camera off, peer not
 * yet joined) we fall back to the participant avatar + name overlay.
 *
 * The mini variant is draggable inside its container so the user can re-park
 * their own preview tile out of the way of the remote feed, matching the web
 * mini box behaviour.
 */

import React, { useMemo, useRef } from "react";
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { RTCView, type MediaStream } from "react-native-webrtc";

import { getS3ImageUrl } from "../../../lib/imageUtils";
import type { CallParticipant } from "../types";
import { meetingTheme } from "../meetingTheme";

function resolveAvatarUri(profilePicture?: string | null): string | null {
  const uri = getS3ImageUrl(profilePicture);
  if (!uri) return null;
  if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;
  return null;
}

export type UserBoxProps = {
  user: CallParticipant | null;
  stream: MediaStream | null;
  /** Hide the video tile and show the avatar instead (camera off / waiting). */
  isStreamOff?: boolean;
  /** Mute the AUDIO element (we always mute the local preview to avoid feedback). */
  muted?: boolean;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Label shown above the avatar fallback. */
  fallbackLabel?: string;
  /** Overrides default "Camera off" / "Connecting…" when stream is off. */
  streamOffHint?: string;
};

export function UserBox({
  user,
  stream,
  isStreamOff,
  muted = false,
  style,
  fallbackLabel,
  streamOffHint,
  onPress,
}: UserBoxProps) {
  const streamId = (stream as any)?.toURL?.() ?? null;
  const displayName =
    user?.fullname || user?.fullName || fallbackLabel || "Waiting…";
  const avatarUri = useMemo(
    () => resolveAvatarUri(user?.profile_picture),
    [user?.profile_picture]
  );

  const boxStyle = [styles.box, style];

  const media = !isStreamOff && streamId ? (
    <RTCView
      key={streamId}
      streamURL={streamId}
      objectFit="cover"
      mirror={muted /* local preview only */}
      style={StyleSheet.absoluteFill}
    />
  ) : (
    <View style={styles.avatarWrap}>
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarInitial}>
            {(displayName?.[0] ?? "?").toUpperCase()}
          </Text>
        </View>
      )}
      <Text style={styles.fallbackName}>{displayName}</Text>
      {isStreamOff ? (
        <Text style={styles.waitingHint}>
          {streamOffHint ??
            (streamId ? "Camera off" : "Connecting video…")}
        </Text>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={boxStyle}
        accessibilityRole="button"
        accessibilityLabel={displayName}
      >
        {media}
      </Pressable>
    );
  }

  return <View style={boxStyle}>{media}</View>;
}

export type UserBoxMiniProps = UserBoxProps & {
  /** When `false`, the mini box stays parked in the corner (no drag). */
  draggable?: boolean;
  initialOffset?: { x: number; y: number };
};

/**
 * Draggable small preview tile. Local user always renders here in the
 * `OneOnOne` layout, mirroring the web mini-box.
 */
export function UserBoxMini({
  draggable = true,
  initialOffset = { x: 0, y: 0 },
  ...rest
}: UserBoxMiniProps) {
  const pan = useRef(
    new Animated.ValueXY({ x: initialOffset.x, y: initialOffset.y })
  ).current;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => draggable,
        onMoveShouldSetPanResponder: () => draggable,
        onPanResponderGrant: () => {
          pan.setOffset({
            x: (pan.x as any)._value,
            y: (pan.y as any)._value,
          });
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: () => pan.flattenOffset(),
      }),
    [draggable, pan]
  );

  return (
    <Animated.View
      style={[
        styles.miniWrap,
        { transform: [{ translateX: pan.x }, { translateY: pan.y }] },
      ]}
      {...responder.panHandlers}
    >
      <UserBox {...rest} style={styles.miniBox} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    width: "100%",
    backgroundColor: meetingTheme.videoPlaceholder,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: meetingTheme.border,
  },
  avatarWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: meetingTheme.surface,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 999,
  },
  avatarPlaceholder: {
    backgroundColor: meetingTheme.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 36,
    color: "#fff",
    fontWeight: "700",
  },
  fallbackName: {
    color: meetingTheme.text,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 12,
  },
  waitingHint: {
    color: meetingTheme.textMuted,
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  miniWrap: {
    position: "absolute",
    right: 16,
    bottom: 120,
    width: 110,
    height: 160,
    zIndex: 50,
  },
  miniBox: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
});
