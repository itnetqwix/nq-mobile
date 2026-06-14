/**
 * Live WebRTC layout — full-screen remote video with a synced draggable local PIP.
 * Trainer drag/hide emits MEETING_TILE_LAYOUT (normalized nx/ny) so iOS ↔ Android
 * trainees mirror the same corner placement across screen sizes.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View, type LayoutRectangle } from "react-native";
import type { MediaStream } from "react-native-webrtc";

import { meetingTheme } from "../meetingTheme";
import type { CallParticipant } from "../types";
import { UserBox } from "./UserBox";
import {
  DraggableVideoPip,
  PIP_HEIGHT,
  PIP_WIDTH,
  type PipEdge,
} from "./DraggableVideoPip";

type Props = {
  localUser: CallParticipant | null;
  remoteUser: CallParticipant | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  localStreamOff?: boolean;
  remoteStreamOff?: boolean;
  localStreamOffHint?: string;
  localLabel?: string;
  remoteLabel?: string;
  onSelectLocal?: () => void;
  onSelectRemote?: () => void;
  bounds: Pick<LayoutRectangle, "width" | "height"> | null;
  safeTop: number;
  pipReservedBottom: number;
  localPipPosition: { x: number; y: number };
  localPipSize?: { w: number; h: number };
  localPipHidden?: boolean;
  localPipHiddenEdge?: PipEdge;
  onLocalPipPositionChange?: (pos: { x: number; y: number }) => void;
  onLocalPipHide?: (edge: PipEdge, lastPosition: { x: number; y: number }) => void;
  onLocalPipRestore?: () => void;
  pipDragDisabled?: boolean;
};

export function DualLiveStage({
  localUser,
  remoteUser,
  localStream,
  remoteStream,
  localStreamOff,
  remoteStreamOff,
  localStreamOffHint,
  localLabel = "You",
  remoteLabel = "Partner",
  onSelectLocal,
  onSelectRemote,
  bounds,
  safeTop,
  pipReservedBottom,
  localPipPosition,
  localPipSize,
  localPipHidden = false,
  localPipHiddenEdge = "right",
  onLocalPipPositionChange,
  onLocalPipHide,
  onLocalPipRestore,
  pipDragDisabled = false,
}: Props) {
  const pipW = localPipSize?.w ?? PIP_WIDTH;
  const pipH = localPipSize?.h ?? PIP_HEIGHT;

  return (
    <View style={styles.root}>
      <Pressable
        style={styles.remotePressable}
        onPress={onSelectRemote}
        disabled={!onSelectRemote}
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

      {bounds ? (
        <DraggableVideoPip
          tileId="local"
          user={localUser}
          stream={localStream}
          isStreamOff={localStreamOff}
          streamOffHint={localStreamOffHint}
          muted
          fallbackLabel={localLabel}
          bounds={bounds}
          safeTop={safeTop}
          pipReservedBottom={pipReservedBottom}
          position={localPipPosition}
          isHidden={localPipHidden}
          hiddenEdge={localPipHiddenEdge}
          tabLabel={localLabel}
          width={pipW}
          height={pipH}
          disabled={pipDragDisabled}
          focusOnTap={!!onSelectLocal}
          onFocus={onSelectLocal}
          onPositionChange={(pos) => onLocalPipPositionChange?.(pos)}
          onHide={(edge, last) => onLocalPipHide?.(edge, last)}
          onRestore={() => onLocalPipRestore?.()}
          zIndex={52}
        />
      ) : null}
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
