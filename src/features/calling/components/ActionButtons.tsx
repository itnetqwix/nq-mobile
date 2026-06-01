/**
 * Compact bottom-bar controls for native portrait calls (monochrome theme).
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { useCall } from "../CallContext";
import { meetingTheme } from "../meetingTheme";
import { ACTION_BAR_HEIGHT } from "../useMeetingChromeInsets";

type Props = {
  onOpenClipPicker?: () => void;
  isTrainer?: boolean;
  inClipMode?: boolean;
  onExitClipMode?: () => void;
  /** Trainer: expand live stream or clip to main stage (synced to trainee). */
  onToggleBigVideo?: () => void;
  bigVideoActive?: boolean;
  annotationArmed?: boolean;
  onToggleDrawing?: () => void;
  /** Trainer: capture lesson screenshot (clip stage or live video). */
  onScreenshot?: () => void;
  screenshotCapturing?: boolean;
  onEndCall?: () => void;
  bottomInset?: number;
  audioRouteLabel?: string;
  onToggleAudioRoute?: () => void;
};

const BTN = 36;
const BTN_END = 40;
const ICON = 18;

export function ActionButtons({
  onOpenClipPicker,
  isTrainer,
  inClipMode,
  onExitClipMode,
  onToggleBigVideo,
  bigVideoActive,
  annotationArmed,
  onToggleDrawing,
  onScreenshot,
  screenshotCapturing = false,
  onEndCall,
  bottomInset = 12,
  audioRouteLabel,
  onToggleAudioRoute,
}: Props) {
  const { micEnabled, cameraEnabled, toggleMute, toggleCamera, switchCamera, endCall } =
    useCall();
  const hangUp = onEndCall ?? endCall;

  return (
    <View style={[styles.bar, { bottom: bottomInset }]} pointerEvents="box-none">
      <View style={styles.row}>
        <RoundButton
          onPress={toggleMute}
          accessibilityLabel={micEnabled ? "Mute microphone" : "Unmute microphone"}
          danger={!micEnabled}
        >
          <Ionicons
            name={micEnabled ? "mic" : "mic-off"}
            size={ICON}
            color={micEnabled ? meetingTheme.text : "#fff"}
          />
        </RoundButton>

        <RoundButton
          onPress={toggleCamera}
          accessibilityLabel={cameraEnabled ? "Turn camera off" : "Turn camera on"}
          danger={!cameraEnabled}
        >
          <Ionicons
            name={cameraEnabled ? "videocam" : "videocam-off"}
            size={ICON}
            color={cameraEnabled ? meetingTheme.text : "#fff"}
          />
        </RoundButton>

        <RoundButton onPress={switchCamera} accessibilityLabel="Switch camera">
          <Ionicons name="camera-reverse-outline" size={ICON} color={meetingTheme.text} />
        </RoundButton>

        {onToggleAudioRoute ? (
          <RoundButton
            onPress={onToggleAudioRoute}
            accessibilityLabel={`Audio route ${audioRouteLabel ?? "Auto"}`}
          >
            <Ionicons name="volume-high-outline" size={ICON} color={meetingTheme.text} />
          </RoundButton>
        ) : null}

        {isTrainer && onToggleBigVideo ? (
          <RoundButton
            onPress={onToggleBigVideo}
            accessibilityLabel={bigVideoActive ? "Exit expanded view" : "Expand video"}
            active={bigVideoActive}
          >
            <Ionicons
              name={bigVideoActive ? "contract-outline" : "expand-outline"}
              size={ICON}
              color={bigVideoActive ? meetingTheme.onPrimary : meetingTheme.text}
            />
          </RoundButton>
        ) : null}

        {isTrainer && inClipMode && onExitClipMode ? (
          <RoundButton onPress={onExitClipMode} accessibilityLabel="Close clips">
            <Ionicons name="close" size={ICON} color={meetingTheme.text} />
          </RoundButton>
        ) : null}

        {!inClipMode && onOpenClipPicker ? (
          <RoundButton
            onPress={onOpenClipPicker}
            accessibilityLabel={
              isTrainer ? "Open clip library" : "Share clips with coach"
            }
          >
            <MaterialCommunityIcons
              name="play-box-multiple-outline"
              size={ICON}
              color={meetingTheme.text}
            />
          </RoundButton>
        ) : null}

        {isTrainer && onToggleDrawing ? (
          <RoundButton
            onPress={onToggleDrawing}
            accessibilityLabel="Annotate on screen"
            active={annotationArmed}
          >
            <MaterialCommunityIcons
              name="gesture"
              size={ICON}
              color={annotationArmed ? meetingTheme.onPrimary : meetingTheme.text}
            />
          </RoundButton>
        ) : null}

        {isTrainer && onScreenshot ? (
          <RoundButton
            onPress={onScreenshot}
            accessibilityLabel="Screenshot"
            disabled={screenshotCapturing}
          >
            <Ionicons
              name="camera-outline"
              size={ICON}
              color={screenshotCapturing ? "rgba(255,255,255,0.4)" : meetingTheme.text}
            />
          </RoundButton>
        ) : null}

        <RoundButton onPress={hangUp} accessibilityLabel="End call" danger large>
          <MaterialCommunityIcons name="phone-hangup" size={ICON + 2} color="#fff" />
        </RoundButton>
      </View>
    </View>
  );
}

function RoundButton({
  children,
  onPress,
  accessibilityLabel,
  danger,
  large,
  active,
}: {
  children: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  danger?: boolean;
  large?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.btn,
        large && styles.btnLarge,
        danger ? styles.btnDanger : styles.btnDefault,
        active && styles.btnActive,
        pressed && { opacity: 0.82 },
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 38,
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
    borderRadius: 999,
    backgroundColor: meetingTheme.barBg,
    borderWidth: 1,
    borderColor: meetingTheme.barBorder,
    minHeight: ACTION_BAR_HEIGHT,
    maxWidth: "96%",
  },
  btn: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: meetingTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: meetingTheme.border,
  },
  btnLarge: {
    width: BTN_END,
    height: BTN_END,
    borderRadius: BTN_END / 2,
    backgroundColor: meetingTheme.danger,
    borderColor: meetingTheme.danger,
  },
  btnDefault: {},
  btnDanger: {
    backgroundColor: meetingTheme.danger,
    borderColor: meetingTheme.danger,
  },
  btnActive: {
    backgroundColor: meetingTheme.text,
    borderColor: meetingTheme.text,
  },
});
