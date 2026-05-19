/**
 * Secondary live stream when one participant is focused on the main stage.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MediaStream } from "react-native-webrtc";

import { meetingTheme } from "../meetingTheme";
import type { CallParticipant } from "../types";
import { UserBox } from "./UserBox";

type Props = {
  user: CallParticipant | null;
  stream: MediaStream | null;
  isStreamOff?: boolean;
  muted?: boolean;
  label: string;
  onPress?: () => void;
};

export function MeetingMiniPip({
  user,
  stream,
  isStreamOff,
  muted,
  label,
  onPress,
}: Props) {
  return (
    <Pressable
      style={styles.wrap}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Focus ${label}`}
    >
      <UserBox
        user={user}
        stream={stream}
        isStreamOff={isStreamOff}
        muted={muted}
        fallbackLabel={label}
        style={styles.box}
      />
      <View style={styles.labelChip}>
        <Text style={styles.labelText} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 12,
    top: 88,
    width: 100,
    height: 140,
    zIndex: 50,
  },
  box: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: meetingTheme.border,
  },
  labelChip: {
    position: "absolute",
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  labelText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
});
