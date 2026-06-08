/**
 * Live WebRTC layout — full-screen remote video with a draggable local PIP.
 * Matches the web one-on-one layout: big remote, small self-view in corner.
 */

import React, { useRef } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { MediaStream } from "react-native-webrtc";

import { meetingTheme } from "../meetingTheme";
import type { CallParticipant } from "../types";
import { UserBox } from "./UserBox";

const PIP_W = 90;
const PIP_H = 120;
const PIP_MARGIN = 10;

type Props = {
  localUser: CallParticipant | null;
  remoteUser: CallParticipant | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  localStreamOff?: boolean;
  remoteStreamOff?: boolean;
  localLabel?: string;
  remoteLabel?: string;
  onSelectLocal?: () => void;
  onSelectRemote?: () => void;
};

export function DualLiveStage({
  localUser,
  remoteUser,
  localStream,
  remoteStream,
  localStreamOff,
  remoteStreamOff,
  localLabel = "You",
  remoteLabel = "Partner",
  onSelectLocal,
  onSelectRemote,
}: Props) {
  const { width, height } = useWindowDimensions();

  // Draggable local PIP position (top-right corner by default)
  const defaultX = width - PIP_W - PIP_MARGIN;
  const defaultY = PIP_MARGIN + 20;
  const pos = useRef(new Animated.ValueXY({ x: defaultX, y: defaultY })).current;
  const lastPos = useRef({ x: defaultX, y: defaultY });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pos.setOffset(lastPos.current);
        pos.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pos.x, dy: pos.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, g) => {
        const nx = Math.max(
          PIP_MARGIN,
          Math.min(width - PIP_W - PIP_MARGIN, lastPos.current.x + g.dx)
        );
        const ny = Math.max(
          PIP_MARGIN,
          Math.min(height - PIP_H - PIP_MARGIN, lastPos.current.y + g.dy)
        );
        pos.flattenOffset();
        lastPos.current = { x: nx, y: ny };
        Animated.spring(pos, {
          toValue: { x: nx, y: ny },
          useNativeDriver: false,
          tension: 180,
          friction: 14,
        }).start();
      },
    })
  ).current;

  return (
    <View style={styles.root}>
      {/* Full-screen remote video */}
      <Pressable
        style={styles.remotePressable}
        onPress={onSelectRemote}
        accessibilityLabel={remoteLabel}
      >
        <UserBox
          user={remoteUser}
          stream={remoteStream}
          isStreamOff={remoteStreamOff}
          fallbackLabel={remoteLabel}
          style={styles.remoteFill}
        />
      </Pressable>
      <Text style={[styles.nameTag, styles.nameTagRemote]}>{remoteLabel}</Text>

      {/* Draggable local PIP */}
      <Animated.View
        style={[styles.pip, { transform: pos.getTranslateTransform() }]}
        {...panResponder.panHandlers}
      >
        <Pressable
          onPress={onSelectLocal}
          style={StyleSheet.absoluteFill}
          disabled={!onSelectLocal}
        />
        <UserBox
          user={localUser}
          stream={localStream}
          isStreamOff={localStreamOff}
          muted
          mirrorPreview={false}
          fallbackLabel={localLabel}
          style={styles.pipFill}
        />
        <Text style={styles.nameTag}>{localLabel}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: meetingTheme.videoPlaceholder,
    borderRadius: 16,
    overflow: "hidden",
  },
  remotePressable: {
    ...StyleSheet.absoluteFillObject,
  },
  remoteFill: {
    flex: 1,
    borderRadius: 16,
  },
  pip: {
    position: "absolute",
    width: PIP_W,
    height: PIP_H,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    backgroundColor: meetingTheme.videoPlaceholder,
  },
  pipFill: {
    flex: 1,
    borderRadius: 10,
  },
  nameTag: {
    position: "absolute",
    bottom: 5,
    left: 7,
    color: "rgba(255,255,255,0.92)",
    fontSize: 10,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  nameTagRemote: {
    bottom: 14,
    left: 14,
    fontSize: 13,
  },
});
