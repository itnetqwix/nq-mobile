/**
 * Compact bottom-bar controls for native portrait calls (monochrome theme).
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { haptics, type HapticKind } from "../../../lib/haptics";
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
  /** Trainer-only: expand/collapse synced live-camera strip during clip review. */
  onToggleCameraStrip?: () => void;
  cameraStripCollapsed?: boolean;
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
  onToggleCameraStrip,
  cameraStripCollapsed = true,
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
          haptic="select"
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
          haptic="select"
        >
          <Ionicons
            name={cameraEnabled ? "videocam" : "videocam-off"}
            size={ICON}
            color={cameraEnabled ? meetingTheme.text : "#fff"}
          />
        </RoundButton>

        <RoundButton onPress={switchCamera} accessibilityLabel="Switch camera" haptic="select">
          <Ionicons name="camera-reverse-outline" size={ICON} color={meetingTheme.text} />
        </RoundButton>

        {onToggleAudioRoute ? (
          <RoundButton
            onPress={onToggleAudioRoute}
            accessibilityLabel={`Audio route ${audioRouteLabel ?? "Auto"}`}
            haptic="tap"
          >
            <Ionicons name="volume-high-outline" size={ICON} color={meetingTheme.text} />
          </RoundButton>
        ) : null}

        {inClipMode && onToggleCameraStrip ? (
          <RoundButton
            onPress={onToggleCameraStrip}
            accessibilityLabel={
              cameraStripCollapsed ? "Show live cameras" : "Hide live cameras"
            }
            active={!cameraStripCollapsed}
            haptic="select"
          >
            <Ionicons
              name={cameraStripCollapsed ? "videocam-outline" : "videocam"}
              size={ICON}
              color={!cameraStripCollapsed ? meetingTheme.onPrimary : meetingTheme.text}
            />
          </RoundButton>
        ) : null}

        {isTrainer && onToggleBigVideo ? (
          <RoundButton
            onPress={onToggleBigVideo}
            accessibilityLabel={bigVideoActive ? "Exit expanded view" : "Expand video"}
            active={bigVideoActive}
            haptic="select"
          >
            <Ionicons
              name={bigVideoActive ? "contract-outline" : "expand-outline"}
              size={ICON}
              color={bigVideoActive ? meetingTheme.onPrimary : meetingTheme.text}
            />
          </RoundButton>
        ) : null}

        {isTrainer && inClipMode && onExitClipMode ? (
          <RoundButton onPress={onExitClipMode} accessibilityLabel="Close clips" haptic="tap">
            <Ionicons name="close" size={ICON} color={meetingTheme.text} />
          </RoundButton>
        ) : null}

        {!inClipMode && onOpenClipPicker ? (
          <RoundButton
            onPress={onOpenClipPicker}
            accessibilityLabel={
              isTrainer ? "Open clip library" : "Share clips with coach"
            }
            haptic="tap"
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
            haptic="impact"
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
            haptic="tap"
          >
            <Ionicons
              name="camera-outline"
              size={ICON}
              color={screenshotCapturing ? "rgba(255,255,255,0.4)" : meetingTheme.text}
            />
          </RoundButton>
        ) : null}

        <RoundButton onPress={hangUp} accessibilityLabel="End call" danger large haptic="warning">
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
  disabled,
  haptic = "tap",
}: {
  children: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  danger?: boolean;
  large?: boolean;
  active?: boolean;
  disabled?: boolean;
  haptic?: HapticKind;
}) {
  const handlePress = () => {
    if (!disabled && haptic !== "none") {
      haptics[haptic]();
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.btn,
        large && styles.btnLarge,
        danger ? styles.btnDanger : styles.btnDefault,
        active && styles.btnActive,
        disabled && styles.btnDisabled,
        pressed && !disabled && { opacity: 0.82 },
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
  btnDisabled: {
    opacity: 0.45,
  },
});
