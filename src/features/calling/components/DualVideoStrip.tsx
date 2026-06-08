/**
 * DualVideoStrip
 * ─────────────
 * A fixed horizontal row of two compact video tiles shown at the bottom of
 * the screen while clips are in the main stage.  Both participants remain
 * visible without blocking the clip area, matching the user's request for
 * "both video streaming boxes at the bottom".
 *
 * The strip slides just above the ActionButtons (respects `bottomOffset`).
 */

import React, { useCallback, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { RTCView, type MediaStream } from "react-native-webrtc";
import { Ionicons } from "@expo/vector-icons";

import type { CallParticipant } from "../types";
import { meetingTheme } from "../meetingTheme";
import { getS3ImageUrl } from "../../../lib/imageUtils";

const TILE_HEIGHT = 90;
const TILE_ASPECT = 4 / 3;

type TileProps = {
  user: CallParticipant | null;
  stream: MediaStream | null;
  isStreamOff?: boolean;
  muted?: boolean;
  label: string;
  style?: StyleProp<ViewStyle>;
};

function VideoTile({ user, stream, isStreamOff, muted = false, label, style }: TileProps) {
  const streamId = (stream as any)?.toURL?.() ?? null;
  const videoCount = stream?.getVideoTracks?.()?.length ?? 0;
  const rtcKey = streamId ? `${streamId}-v${videoCount}` : "no-stream";
  const avatarUri = getS3ImageUrl(user?.profile_picture ?? null);
  const displayName = user?.fullname ?? user?.fullName ?? label;

  return (
    <View style={[styles.tile, style]}>
      {!isStreamOff && streamId ? (
        <RTCView
          key={rtcKey}
          streamURL={streamId}
          objectFit="cover"
          mirror={false}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={styles.avatarWrap}>
          {avatarUri ? (
            // eslint-disable-next-line react-native/no-inline-styles
            <View style={{ width: 32, height: 32, borderRadius: 16, overflow: "hidden" }}>
              {/* Use RTCView placeholder avatar */}
            </View>
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {(displayName?.[0] ?? "?").toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      )}
      {/* Name badge */}
      <View style={styles.nameBadge}>
        {isStreamOff ? (
          <Ionicons
            name="videocam-off"
            size={10}
            color="rgba(255,255,255,0.75)"
            style={{ marginRight: 3 }}
          />
        ) : null}
        <Text style={styles.nameText} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

type Props = {
  localUser: CallParticipant | null;
  remoteUser: CallParticipant | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  localStreamOff?: boolean;
  remoteStreamOff?: boolean;
  peerDisplayName: string;
  /** Bottom inset so the strip sits above the action-bar (pass `chrome.bottomChrome`). */
  bottomOffset?: number;
  /** Called when either tile is tapped — lets the caller expand to full-screen. */
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
  peerDisplayName,
  bottomOffset = 80,
  onTapLocal,
  onTapRemote,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapse = useCallback(() => setCollapsed((v) => !v), []);

  if (collapsed) {
    return (
      <Pressable
        style={[styles.collapsedPill, { bottom: bottomOffset + 8 }]}
        onPress={toggleCollapse}
        accessibilityLabel="Show live cameras"
      >
        <Ionicons name="videocam-outline" size={14} color="#fff" />
        <Text style={styles.collapsedText}>Show cameras</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.strip, { bottom: bottomOffset + 4 }]} pointerEvents="box-none">
      <Pressable
        style={styles.tile}
        onPress={onTapLocal}
        accessibilityLabel="Your camera"
        disabled={!onTapLocal}
        pointerEvents="auto"
      >
        <VideoTile
          user={localUser}
          stream={localStream}
          isStreamOff={localStreamOff}
          muted
          label="You"
        />
      </Pressable>

      <Pressable
        style={styles.tile}
        onPress={onTapRemote}
        accessibilityLabel={peerDisplayName}
        disabled={!onTapRemote}
        pointerEvents="auto"
      >
        <VideoTile
          user={remoteUser}
          stream={remoteStream}
          isStreamOff={remoteStreamOff}
          label={peerDisplayName.split(" ")[0] ?? "Partner"}
        />
      </Pressable>

      <Pressable
        style={styles.collapseBtn}
        onPress={toggleCollapse}
        hitSlop={8}
        accessibilityLabel="Hide cameras"
        pointerEvents="auto"
      >
        <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.7)" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
    zIndex: 25,
  },
  tile: {
    flex: 1,
    height: TILE_HEIGHT,
    maxWidth: TILE_HEIGHT * TILE_ASPECT,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: meetingTheme.videoPlaceholder,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
  },
  avatarWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: meetingTheme.surface,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: meetingTheme.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  nameBadge: {
    position: "absolute",
    bottom: 5,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  nameText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 10,
    fontWeight: "600",
    maxWidth: 70,
  },
  collapseBtn: {
    position: "absolute",
    right: -4,
    top: -10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  collapsedPill: {
    position: "absolute",
    left: 12,
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
