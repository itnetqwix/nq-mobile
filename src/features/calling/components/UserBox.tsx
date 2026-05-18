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
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { RTCView, type MediaStream } from "react-native-webrtc";

import type { CallParticipant } from "../types";

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
};

export function UserBox({
  user,
  stream,
  isStreamOff,
  muted = false,
  style,
  fallbackLabel,
  onPress,
}: UserBoxProps) {
  const streamId = (stream as any)?.toURL?.() ?? null;
  const displayName =
    user?.fullname || user?.fullName || fallbackLabel || "Waiting…";

  const content = (
    <View style={[styles.box, style]}>
      {!isStreamOff && streamId ? (
        <RTCView
          key={streamId}
          streamURL={streamId}
          objectFit="cover"
          mirror={muted /* local preview only */}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={styles.avatarWrap}>
          {user?.profile_picture ? (
            <Image
              source={{ uri: user.profile_picture }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {(displayName?.[0] ?? "?").toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.fallbackName}>{displayName}</Text>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <View onTouchEnd={onPress} accessible accessibilityRole="imagebutton">
        {content}
      </View>
    );
  }
  return content;
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
    backgroundColor: "#111",
    borderRadius: 20,
    overflow: "hidden",
  },
  avatarWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#1a1a1a",
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 999,
  },
  avatarPlaceholder: {
    backgroundColor: "#000080",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 36,
    color: "#fff",
    fontWeight: "700",
  },
  fallbackName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 12,
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
