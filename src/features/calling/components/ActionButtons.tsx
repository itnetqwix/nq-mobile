/**
 * ActionButtons — bottom-bar control row for the native portrait call. Mirrors
 * the web `app/components/portrait-calling/action-buttons.jsx` ergonomics:
 *
 *   • Mic toggle  → CallContext.toggleMute() → engine emits MUTE_ME
 *   • Camera off  → CallContext.toggleCamera() → engine emits STOP_FEED
 *   • Flip camera → CallContext.switchCamera() (no socket event, local only)
 *   • End call    → CallContext.endCall() → engine emits 'close', tears down
 *   • Open clips  → invoked only for trainers; opens the locker picker.
 *
 * The buttons read straight from `useCall()` so the screen stays declarative.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { useCall } from "../CallContext";

type Props = {
  /** Trainer-only: open the clip selector modal. */
  onOpenClipPicker?: () => void;
  isTrainer?: boolean;
  /** Optional screenshot capture (trainer-only). */
  onScreenshot?: () => void;
  bottomInset?: number;
};

export function ActionButtons({
  onOpenClipPicker,
  isTrainer,
  onScreenshot,
  bottomInset = 20,
}: Props) {
  const {
    micEnabled,
    cameraEnabled,
    toggleMute,
    toggleCamera,
    switchCamera,
    endCall,
  } = useCall();

  return (
    <View style={[styles.bar, { bottom: bottomInset }]} pointerEvents="box-none">
      <View style={styles.row}>
        <RoundButton
          onPress={toggleMute}
          accessibilityLabel={micEnabled ? "Mute mic" : "Unmute mic"}
          danger={!micEnabled}
        >
          <Ionicons
            name={micEnabled ? "mic" : "mic-off"}
            size={22}
            color="#fff"
          />
        </RoundButton>

        <RoundButton
          onPress={toggleCamera}
          accessibilityLabel={cameraEnabled ? "Turn camera off" : "Turn camera on"}
          danger={!cameraEnabled}
        >
          <Ionicons
            name={cameraEnabled ? "videocam" : "videocam-off"}
            size={22}
            color="#fff"
          />
        </RoundButton>

        <RoundButton
          onPress={switchCamera}
          accessibilityLabel="Flip camera"
        >
          <MaterialCommunityIcons
            name="camera-switch"
            size={22}
            color="#fff"
          />
        </RoundButton>

        {isTrainer && onOpenClipPicker ? (
          <RoundButton
            onPress={onOpenClipPicker}
            accessibilityLabel="Open clips"
          >
            <MaterialCommunityIcons
              name="video-vintage"
              size={22}
              color="#fff"
            />
          </RoundButton>
        ) : null}

        {isTrainer && onScreenshot ? (
          <RoundButton onPress={onScreenshot} accessibilityLabel="Screenshot">
            <Ionicons name="camera" size={22} color="#fff" />
          </RoundButton>
        ) : null}

        <RoundButton
          onPress={endCall}
          accessibilityLabel="End call"
          danger
          large
        >
          <Ionicons name="call" size={26} color="#fff" />
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
}: {
  children: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  danger?: boolean;
  large?: boolean;
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
        pressed && { opacity: 0.75 },
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
    alignItems: "center",
    zIndex: 30,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
    gap: 12,
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  btnLarge: {
    width: 56,
    height: 56,
    transform: [{ rotate: "135deg" }],
  },
  btnDefault: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  btnDanger: {
    backgroundColor: "#e53935",
  },
});

// Type augmentation to silence lint about unused Text import in some setups
void Text;
