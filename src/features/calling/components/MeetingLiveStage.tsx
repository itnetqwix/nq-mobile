/**
 * Full-stage live WebRTC view when trainer focuses a camera tile (web `selectedUser` parity).
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
  onClearFocus?: () => void;
  isTrainer?: boolean;
};

export function MeetingLiveStage({
  user,
  stream,
  isStreamOff,
  muted,
  label,
  onClearFocus,
  isTrainer,
}: Props) {
  return (
    <View style={styles.root}>
      <UserBox
        user={user}
        stream={stream}
        isStreamOff={isStreamOff}
        muted={muted}
        fallbackLabel={label}
        style={styles.video}
      />
      {isTrainer && onClearFocus ? (
        <Pressable style={styles.backBtn} onPress={onClearFocus} accessibilityRole="button">
          <Text style={styles.backBtnText}>Back to clips</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: meetingTheme.videoPlaceholder,
  },
  video: {
    flex: 1,
    borderRadius: 16,
  },
  backBtn: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  backBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
});
