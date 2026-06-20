/**
 * Locked dual-clip stage — two stacked players, one shared timeline (web parity).
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { ClipPlaybackControls } from "./ClipPlaybackControls";
import { ClipPlayer } from "./ClipPlayer";
import { ClipZoomControls } from "./ClipZoomControls";
import type { ClipPlayerPaneProps } from "./UnlockedDualClipStage";

const CLIP_BG = "#ffffff";

type Props = {
  uris: [string, string];
  makePaneProps: (paneIndex: 0 | 1) => ClipPlayerPaneProps;
  isTrainer: boolean;
  isPlaying: boolean;
  progressSeconds: number;
  durationSeconds: number;
  onTogglePlay: () => void;
  onSeek: (seconds: number, commit?: boolean) => void;
  onPaneLayout?: (
    paneIndex: 0 | 1,
    layout: { x: number; y: number; width: number; height: number }
  ) => void;
  capturing?: boolean;
  /** When set, show only this pane at full height (annotation / focus mode). */
  focusPaneIndex?: 0 | 1 | null;
  /** Hide shared timeline while annotating so controls do not overlap. */
  hideTimeline?: boolean;
  /** Locked playback — play/pause only, no shared scrub. */
  seekEnabled?: boolean;
  paneLabels?: [string, string];
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
  onPaneLayout,
  capturing = false,
  focusPaneIndex = null,
  hideTimeline = false,
  seekEnabled = true,
  paneLabels,
}: Props) {
  const singlePaneFocus = focusPaneIndex === 0 || focusPaneIndex === 1;

  return (
    <View style={styles.root}>
      <View style={styles.stack}>
        {([0, 1] as const).map((paneIndex) => {
          if (singlePaneFocus && focusPaneIndex !== paneIndex) return null;
          const paneProps = makePaneProps(paneIndex);
          const label = paneLabels?.[paneIndex];
          return (
            <View
              key={paneIndex}
              style={[styles.pane, singlePaneFocus && styles.paneFocused]}
              onLayout={(e) => {
                const { x, y, width, height } = e.nativeEvent.layout;
                onPaneLayout?.(paneIndex, { x, y, width, height });
              }}
            >
              {singlePaneFocus && label ? (
                <View style={styles.paneBadge} pointerEvents="none">
                  <Text style={styles.paneBadgeText}>{label}</Text>
                </View>
              ) : null}
              <ClipPlayer uri={uris[paneIndex]} {...paneProps} />
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
          );
        })}
      </View>
      {isTrainer && !capturing && !hideTimeline ? (
        <View style={styles.controlsFooter}>
          <ClipPlaybackControls
            variant="inline"
            size="slim"
            onLightBackground
            isPlaying={isPlaying}
            onTogglePlay={onTogglePlay}
            progressSeconds={progressSeconds}
            durationSeconds={durationSeconds}
            onSeek={onSeek}
            seekEnabled={seekEnabled}
            disabled={!uris[0] || !uris[1]}
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
    flex: 1,
    overflow: "hidden",
    borderRadius: 8,
    minHeight: 140,
    backgroundColor: CLIP_BG,
    position: "relative",
  },
  paneFocused: {
    minHeight: 200,
  },
  paneBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,128,0.82)",
  },
  paneBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  controlsFooter: {
    backgroundColor: CLIP_BG,
    paddingTop: 3,
    paddingBottom: 3,
    paddingHorizontal: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.10)",
  },
});
