/**
 * Split live WebRTC layout when no clips are active (web one-on-one-layout parity).
 */

import React from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { MediaStream } from "react-native-webrtc";

import { meetingTheme } from "../meetingTheme";
import type { CallParticipant } from "../types";
import { UserBox } from "./UserBox";

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
  const landscape = width > height;

  return (
    <View style={[styles.root, landscape && styles.rootLandscape]}>
      <View style={[styles.pane, landscape && styles.paneLandscape]}>
        <UserBox
          user={localUser}
          stream={localStream}
          isStreamOff={localStreamOff}
          muted
          fallbackLabel={localLabel}
          onPress={onSelectLocal}
          style={styles.video}
        />
        <Text style={styles.label}>{localLabel}</Text>
      </View>
      <View style={[styles.pane, landscape && styles.paneLandscape]}>
        <UserBox
          user={remoteUser}
          stream={remoteStream}
          isStreamOff={remoteStreamOff}
          fallbackLabel={remoteLabel}
          onPress={onSelectRemote}
          style={styles.video}
        />
        <Text style={styles.label}>{remoteLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "column",
    gap: 8,
    paddingHorizontal: 4,
  },
  rootLandscape: {
    flexDirection: "row",
    gap: 10,
  },
  pane: {
    flex: 1,
    minHeight: 120,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: meetingTheme.videoPlaceholder,
  },
  paneLandscape: {
    minHeight: 0,
  },
  video: {
    flex: 1,
    borderRadius: 16,
  },
  label: {
    position: "absolute",
    bottom: 8,
    left: 10,
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
