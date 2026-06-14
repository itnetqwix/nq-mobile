/**
 * Small draggable-style clip preview when live video is focused during clip mode.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ClipPlayer } from "./ClipPlayer";
import { meetingTheme } from "../meetingTheme";

type Props = {
  uri: string | null;
  label?: string;
  isPlaying?: boolean;
  onPress?: () => void;
  bottomOffset: number;
};

export function ClipMiniPip({ uri, label = "Clips", isPlaying = false, onPress, bottomOffset }: Props) {
  return (
    <Pressable
      style={[styles.wrap, { bottom: bottomOffset }]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel="Return to clips"
    >
      <View style={styles.box}>
        {uri ? (
          <ClipPlayer uri={uri} isPlaying={isPlaying} />
        ) : (
          <View style={styles.fallback}>
            <Ionicons name="film-outline" size={28} color={meetingTheme.textMuted} />
          </View>
        )}
        <View style={styles.chip}>
          <Ionicons name="film-outline" size={12} color="#fff" />
          <Text style={styles.chipText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    width: 88,
    height: 124,
    zIndex: 52,
  },
  box: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: meetingTheme.border,
    backgroundColor: meetingTheme.videoPlaceholder,
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    position: "absolute",
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  chipText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
});
