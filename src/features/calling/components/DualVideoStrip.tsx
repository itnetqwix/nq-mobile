/**
 * Synced live-camera PIPs during clip review — trainer drag emits
 * MEETING_TILE_LAYOUT (normalized nx/ny) so iOS ↔ Android stay aligned.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
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
  /** Lower during annotation so toolbar stays on top. */
  pipZIndex?: number;
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
  collapsedBottom: _collapsedBottom,
  collapsed,
  onCollapsedChange: _onCollapsedChange,
  showCollapseControl: _showCollapseControl = false,
  localPip,
  remotePip,
  pipDragDisabled = false,
  onTapLocal,
  onTapRemote,
  pipZIndex = 46,
}: Props) {
  const remoteLabel = peerDisplayName.split(" ")[0] ?? "Partner";
  const localW = localPip.size?.w ?? CLIP_MODE_PIP.w;
  const localH = localPip.size?.h ?? CLIP_MODE_PIP.h;
  const remoteW = remotePip.size?.w ?? CLIP_MODE_PIP.w;
  const remoteH = remotePip.size?.h ?? CLIP_MODE_PIP.h;

  if (collapsed) {
    return null;
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
        zIndex={pipZIndex}
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
        zIndex={pipZIndex + 1}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 25,
    pointerEvents: "box-none",
  },
});
