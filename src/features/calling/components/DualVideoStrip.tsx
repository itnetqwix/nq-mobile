/**
 * Synced live-camera PIPs during clip review — trainer drag emits
 * MEETING_TILE_LAYOUT (normalized nx/ny) so iOS ↔ Android stay aligned.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MediaStream } from "react-native-webrtc";

import type { CallParticipant } from "../types";
import {
  DraggableVideoPip,
  type PipEdge,
} from "./DraggableVideoPip";
import { CLIP_MODE_PIP } from "../meetingTileUtils";

type SyncedPip = {
  position: { x: number; y: number };
  size?: { w: number; h: number };
  hidden?: boolean;
  hiddenEdge?: PipEdge;
  onPositionChange?: (pos: { x: number; y: number }) => void;
  onHide?: (edge: PipEdge, lastPosition: { x: number; y: number }) => void;
  onRestore?: () => void;
};

type Props = {
  localUser: CallParticipant | null;
  remoteUser: CallParticipant | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  localStreamOff?: boolean;
  remoteStreamOff?: boolean;
  localStreamOffHint?: string;
  remoteStreamOffHint?: string;
  peerDisplayName: string;
  bounds: { width: number; height: number } | null;
  safeTop: number;
  pipReservedBottom: number;
  /** When collapsed, dock the pill on the action bar row (below clip timeline). */
  collapsedBottom?: number;
  /** Trainer-controlled; synced to trainee via MEETING_TILE_LAYOUT. */
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  /** Hide chevron collapse control on trainee devices. */
  showCollapseControl?: boolean;
  localPip: SyncedPip;
  remotePip: SyncedPip;
  pipDragDisabled?: boolean;
  onTapLocal?: () => void;
  onTapRemote?: () => void;
};

export function DualVideoStrip({
  localUser,
  remoteUser,
  localStream,
  remoteStream,
  localStreamOff,
  remoteStreamOff,
  localStreamOffHint,
  remoteStreamOffHint,
  peerDisplayName,
  bounds,
  safeTop,
  pipReservedBottom,
  collapsedBottom,
  collapsed,
  onCollapsedChange,
  showCollapseControl = false,
  localPip,
  remotePip,
  pipDragDisabled = false,
  onTapLocal,
  onTapRemote,
}: Props) {
  const remoteLabel = peerDisplayName.split(" ")[0] ?? "Partner";
  const localW = localPip.size?.w ?? CLIP_MODE_PIP.w;
  const localH = localPip.size?.h ?? CLIP_MODE_PIP.h;
  const remoteW = remotePip.size?.w ?? CLIP_MODE_PIP.w;
  const remoteH = remotePip.size?.h ?? CLIP_MODE_PIP.h;
  const dockBottom = collapsedBottom ?? pipReservedBottom + 8;

  if (collapsed) {
    if (!showCollapseControl) return null;
    return (
      <Pressable
        style={[styles.collapsedPill, { bottom: dockBottom }]}
        onPress={() => onCollapsedChange(false)}
        accessibilityLabel="Show live cameras"
      >
        <Ionicons name="videocam-outline" size={14} color="#fff" />
        <Text style={styles.collapsedText}>Show cameras</Text>
      </Pressable>
    );
  }

  if (!bounds) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <DraggableVideoPip
        tileId="remote"
        user={remoteUser}
        stream={remoteStream}
        isStreamOff={remoteStreamOff}
        streamOffHint={remoteStreamOffHint}
        fallbackLabel={remoteLabel}
        bounds={bounds}
        safeTop={safeTop}
        pipReservedBottom={pipReservedBottom}
        position={remotePip.position}
        isHidden={!!remotePip.hidden}
        hiddenEdge={remotePip.hiddenEdge ?? "left"}
        tabLabel={remoteLabel}
        width={remoteW}
        height={remoteH}
        disabled={pipDragDisabled}
        focusOnTap={!!onTapRemote}
        onFocus={onTapRemote}
        onPositionChange={(pos) => remotePip.onPositionChange?.(pos)}
        onHide={(edge, last) => remotePip.onHide?.(edge, last)}
        onRestore={() => remotePip.onRestore?.()}
        zIndex={46}
      />

      <DraggableVideoPip
        tileId="local"
        user={localUser}
        stream={localStream}
        isStreamOff={localStreamOff}
        streamOffHint={localStreamOffHint}
        muted
        fallbackLabel="You"
        bounds={bounds}
        safeTop={safeTop}
        pipReservedBottom={pipReservedBottom}
        position={localPip.position}
        isHidden={!!localPip.hidden}
        hiddenEdge={localPip.hiddenEdge ?? "right"}
        tabLabel="You"
        width={localW}
        height={localH}
        disabled={pipDragDisabled}
        focusOnTap={!!onTapLocal}
        onFocus={onTapLocal}
        onPositionChange={(pos) => localPip.onPositionChange?.(pos)}
        onHide={(edge, last) => localPip.onHide?.(edge, last)}
        onRestore={() => localPip.onRestore?.()}
        zIndex={47}
      />

      {showCollapseControl ? (
        <Pressable
          style={[styles.collapseBtn, { bottom: dockBottom }]}
          onPress={() => onCollapsedChange(true)}
          hitSlop={8}
          accessibilityLabel="Hide cameras"
        >
          <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.85)" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 25,
    pointerEvents: "box-none",
  },
  collapseBtn: {
    position: "absolute",
    left: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    zIndex: 56,
  },
  collapsedPill: {
    position: "absolute",
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 25,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  collapsedText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});
