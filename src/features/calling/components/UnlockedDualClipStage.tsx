/**
 * Dual unlocked clips — each pane has video + timeline at bottom (web clip-player-frame).
 */

import React from "react";
import { StyleSheet, View } from "react-native";

import { ClipPlaybackControls } from "./ClipPlaybackControls";
import { ClipPlayer } from "./ClipPlayer";
import { ClipZoomControls } from "./ClipZoomControls";

const CLIP_BG = "#ffffff";

export type ClipPlayerPaneProps = {
  isPlaying: boolean;
  seekTargetMs: number | null;
  seekNonce?: number | null;
  zoom?: number;
  pan?: { x: number; y: number };
  zoomGesturesEnabled?: boolean;
  onZoomPanChange?: (
    zoom: number,
    pan: { x: number; y: number },
    emit?: false | "throttle" | "immediate"
  ) => void;
  onZoomPanEnd?: () => void;
  onProgressSeconds: (seconds: number) => void;
  onDurationSeconds: (seconds: number) => void;
  onEnded?: () => void;
  showZoomControls?: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFrameLayout?: (width: number, height: number) => void;
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
  /** When true, render only the video frames (no controls / zoom buttons)
   *  so screenshots match the web `hide-in-screenshot` behavior. */
  capturing?: boolean;
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
  capturing = false,
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
          const paneProps = makePaneProps(paneIndex);
          return (
            <View
              key={paneIndex}
              style={[styles.pane, showBoth ? styles.paneHalf : styles.paneFocused]}
            >
              <View style={styles.player}>
                <ClipPlayer uri={uri} {...paneProps} />
                {!capturing &&
                paneProps.showZoomControls &&
                paneProps.onZoomIn &&
                paneProps.onZoomOut ? (
                  <ClipZoomControls
                    onZoomIn={paneProps.onZoomIn}
                    onZoomOut={paneProps.onZoomOut}
                  />
                ) : null}
              </View>
              {isTrainer && !capturing ? (
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
    minHeight: 120,
    position: "relative",
  },
  controlsDock: {
    flexShrink: 0,
    paddingTop: 3,
    paddingBottom: 3,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.10)",
  },
});
