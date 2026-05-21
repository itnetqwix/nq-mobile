/**
 * Dual unlocked clips — each pane has video + timeline at bottom (web clip-player-frame).
 */

import React from "react";
import { StyleSheet, View } from "react-native";

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
              <View style={styles.player}>
                <ClipPlayer uri={uri} {...makePaneProps(paneIndex)} />
              </View>
              {isTrainer ? (
                <View style={styles.controlsDock}>
                  <ClipPlaybackControls
                    variant="inline"
                    size="compact"
                    isPlaying={isPlayingByPane[paneIndex]}
                    onTogglePlay={() => onTogglePlay(paneIndex)}
                    progressSeconds={progressSecondsByPane[paneIndex]}
                    durationSeconds={durationSecondsByPane[paneIndex]}
                    onSeek={(sec) => onSeek(paneIndex, sec)}
                    disabled={!uri}
                    showExpand={!!onToggleExpand}
                    isExpanded={clipFocusIndex === paneIndex}
                    onToggleExpand={
                      onToggleExpand ? () => onToggleExpand(paneIndex) : undefined
                    }
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
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
    flexDirection: "column",
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
  player: {
    flex: 1,
    minHeight: 80,
  },
  controlsDock: {
    flexShrink: 0,
    paddingTop: 2,
    paddingBottom: 2,
  },
});
