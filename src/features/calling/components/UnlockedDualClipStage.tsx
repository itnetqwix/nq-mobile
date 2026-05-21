/**
 * Dual unlocked clips — stacked players, shared controls footer inside one clip box.
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ClipPlaybackControls } from "./ClipPlaybackControls";
import { ClipPlayer } from "./ClipPlayer";

const CLIP_BG = "#ffffff";

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
  isPlayingByPane: [boolean, boolean];
  progressSecondsByPane: [number, number];
  durationSecondsByPane: [number, number];
  onTogglePlay: (paneIndex: 0 | 1) => void;
  onSeek: (paneIndex: 0 | 1, seconds: number) => void;
  clipFocusIndex?: 0 | 1 | null;
  onToggleExpand?: (paneIndex: 0 | 1) => void;
};

export function UnlockedDualClipStage({
  uris,
  makePaneProps,
  isTrainer,
  isPlayingByPane,
  progressSecondsByPane,
  durationSecondsByPane,
  onTogglePlay,
  onSeek,
  clipFocusIndex = null,
  onToggleExpand,
}: Props) {
  const showBoth = clipFocusIndex == null;

  return (
    <View style={styles.root}>
      <View style={styles.stack}>
        {([0, 1] as const).map((paneIndex) => {
          const uri = uris[paneIndex];
          if (!uri) return null;
          const visible = showBoth || clipFocusIndex === paneIndex;
          if (!visible) return null;
          return (
            <View
              key={paneIndex}
              style={[styles.pane, showBoth ? styles.paneHalf : styles.paneFocused]}
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
                    color="#333"
                  />
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
      {isTrainer && showBoth ? (
        <View style={styles.controlsFooter}>
          {([0, 1] as const).map((paneIndex) =>
            uris[paneIndex] ? (
              <ClipPlaybackControls
                key={paneIndex}
                variant="inline"
                size="compact"
                isPlaying={isPlayingByPane[paneIndex]}
                onTogglePlay={() => onTogglePlay(paneIndex)}
                progressSeconds={progressSecondsByPane[paneIndex]}
                durationSeconds={durationSecondsByPane[paneIndex]}
                onSeek={(sec) => onSeek(paneIndex, sec)}
                disabled={!uris[paneIndex]}
              />
            ) : null
          )}
        </View>
      ) : isTrainer && clipFocusIndex != null ? (
        <View style={styles.controlsFooter}>
          <ClipPlaybackControls
            variant="inline"
            size="compact"
            isPlaying={isPlayingByPane[clipFocusIndex]}
            onTogglePlay={() => onTogglePlay(clipFocusIndex)}
            progressSeconds={progressSecondsByPane[clipFocusIndex]}
            durationSeconds={durationSecondsByPane[clipFocusIndex]}
            onSeek={(sec) => onSeek(clipFocusIndex, sec)}
            disabled={!uris[clipFocusIndex]}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CLIP_BG,
  },
  stack: {
    flex: 1,
    flexDirection: "column",
    gap: 4,
  },
  pane: {
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: CLIP_BG,
  },
  paneHalf: {
    flex: 1,
    minHeight: 100,
  },
  paneFocused: {
    flex: 1,
  },
  controlsFooter: {
    backgroundColor: CLIP_BG,
    paddingTop: 4,
    paddingBottom: 2,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.12)",
  },
  expandBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 8,
  },
});
