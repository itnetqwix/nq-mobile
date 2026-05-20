/**
 * Locked dual-clip stage — two stacked players, one shared timeline (web parity).
 */

import React from "react";
import { StyleSheet, View } from "react-native";

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
};

export function LockedDualClipStage({
  uris,
  makePaneProps,
  isTrainer,
  isPlaying,
  progressSeconds,
  durationSeconds,
  onTogglePlay,
  onSeek,
}: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.stack}>
        {([0, 1] as const).map((paneIndex) => (
          <View key={paneIndex} style={styles.pane}>
            <ClipPlayer uri={uris[paneIndex]} {...makePaneProps(paneIndex)} />
          </View>
        ))}
      </View>
      {isTrainer ? (
        <ClipPlaybackControls
          variant="inline"
          size="compact"
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          progressSeconds={progressSeconds}
          durationSeconds={durationSeconds}
          onSeek={onSeek}
          disabled={!uris[0] || !uris[1]}
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
});
