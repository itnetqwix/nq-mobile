/**
 * Corner live-camera PIPs during clip review — remote + local tiles float above
 * the action bar (not a full-width bottom strip).
 */

import React, { useCallback, useState } from "react";
import {
  Image,
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

const TILE_W = 108;
const TILE_H = 132;

type TileProps = {
  user: CallParticipant | null;
  stream: MediaStream | null;
  isStreamOff?: boolean;
  muted?: boolean;
  label: string;
  style?: StyleProp<ViewStyle>;
};

function VideoTile({ user, stream, isStreamOff, muted = false, label, style }: TileProps) {
  const streamId = (stream as { toURL?: () => string } | null)?.toURL?.() ?? null;
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
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {(displayName?.[0] ?? "?").toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      )}
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
  bottomOffset?: number;
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

  const remoteLabel = peerDisplayName.split(" ")[0] ?? "Partner";

  return (
    <View style={[styles.overlay, { bottom: bottomOffset + 6 }]} pointerEvents="box-none">
      <Pressable
        style={[styles.tile, styles.tileLeft]}
        onPress={onTapLocal}
        accessibilityLabel="Your camera"
        disabled={!onTapLocal}
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
        style={[styles.tile, styles.tileRight]}
        onPress={onTapRemote}
        accessibilityLabel={peerDisplayName}
        disabled={!onTapRemote}
      >
        <VideoTile
          user={remoteUser}
          stream={remoteStream}
          isStreamOff={remoteStreamOff}
          label={remoteLabel}
        />
      </Pressable>

      <Pressable
        style={styles.collapseBtn}
        onPress={toggleCollapse}
        hitSlop={8}
        accessibilityLabel="Hide cameras"
      >
        <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.85)" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    height: TILE_H + 8,
    zIndex: 25,
    pointerEvents: "box-none",
  },
  tile: {
    position: "absolute",
    width: TILE_W,
    height: TILE_H,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: meetingTheme.videoPlaceholder,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.28)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  tileLeft: {
    left: 14,
    bottom: 0,
  },
  tileRight: {
    right: 14,
    bottom: 0,
  },
  avatarWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: meetingTheme.surface,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#000080",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  nameBadge: {
    position: "absolute",
    bottom: 6,
    left: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.62)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  nameText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },
  collapseBtn: {
    position: "absolute",
    alignSelf: "center",
    bottom: TILE_H + 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
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
