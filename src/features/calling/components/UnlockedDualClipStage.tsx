/**
 * Dual unlocked clips — stacked players, one shared compact timeline at bottom.
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ClipPlaybackControls } from "./ClipPlaybackControls";
import { ClipPlayer } from "./ClipPlayer";

type ClipPlayerPaneProps = {
  isPlaying: boolean;
  seekTargetMs: number | null;
  onProgressSeconds: (seconds: number) => void;
  onDurationSeconds: (seconds: number) => void;
};

type Props = {
  uris: [string, string];
  makePaneProps: (paneIndex: 0 | 1) => ClipPlayerPaneProps;
  isTrainer: boolean;
  isPlaying: boolean;
  progressSeconds: number;
  durationSeconds: number;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  controlsBottomOffset?: number;
  clipFocusIndex?: 0 | 1 | null;
  onToggleExpand?: (paneIndex: 0 | 1) => void;
};

export function UnlockedDualClipStage({
  uris,
  makePaneProps,
  isTrainer,
  isPlaying,
  progressSeconds,
  durationSeconds,
  onTogglePlay,
  onSeek,
  controlsBottomOffset = 108,
  clipFocusIndex = null,
  onToggleExpand,
}: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.stack}>
        {([0, 1] as const).map((paneIndex) => {
          const uri = uris[paneIndex];
          if (!uri) return null;
          const focused =
            clipFocusIndex == null || clipFocusIndex === paneIndex;
          if (!focused) return null;
          return (
            <View
              key={paneIndex}
              style={[
                styles.pane,
                clipFocusIndex != null && styles.paneFocused,
              ]}
            >
              <ClipPlayer uri={uri} {...makePaneProps(paneIndex)} />
              {isTrainer && onToggleExpand ? (
                <Pressable
                  style={styles.expandBtn}
                  onPress={() => onToggleExpand(paneIndex)}
                  accessibilityLabel={
                    clipFocusIndex === paneIndex
                      ? "Exit expanded clip"
                      : "Expand clip"
                  }
                >
                  <Ionicons
                    name={
                      clipFocusIndex === paneIndex
                        ? "contract-outline"
                        : "expand-outline"
                    }
                    size={20}
                    color="#fff"
                  />
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
      {isTrainer ? (
        <ClipPlaybackControls
          variant="floating"
          size="compact"
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          progressSeconds={progressSeconds}
          durationSeconds={durationSeconds}
          onSeek={onSeek}
          disabled={!uris[0] || !uris[1]}
          bottomOffset={controlsBottomOffset}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  stack: {
    flex: 1,
    flexDirection: "column",
    gap: 4,
  },
  pane: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 10,
    minHeight: 100,
  },
  paneFocused: {
    flex: 1,
  },
  expandBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 8,
  },
});
