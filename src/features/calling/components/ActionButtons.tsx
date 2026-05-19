/**
 * Compact bottom-bar controls for native portrait calls (light theme).
 */

import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { useCall } from "../CallContext";
import { meetingTheme } from "../meetingTheme";

type Props = {
  onOpenClipPicker?: () => void;
  isTrainer?: boolean;
  onScreenshot?: () => void;
  inClipMode?: boolean;
  lockMode?: boolean;
  onToggleLock?: () => void;
  onExitClipMode?: () => void;
  onToggleLayout?: () => void;
  drawingEnabled?: boolean;
  onToggleDrawing?: () => void;
  onEndCall?: () => void;
  bottomInset?: number;
};

const BTN = 40;
const BTN_END = 46;

export function ActionButtons({
  onOpenClipPicker,
  isTrainer,
  onScreenshot,
  inClipMode,
  lockMode,
  onToggleLock,
  onExitClipMode,
  onToggleLayout,
  drawingEnabled,
  onToggleDrawing,
  onEndCall,
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
  const hangUp = onEndCall ?? endCall;
  const [moreOpen, setMoreOpen] = useState(false);

  const trainerExtras =
    isTrainer && (onScreenshot || onToggleDrawing || onOpenClipPicker);

  return (
    <View style={[styles.bar, { bottom: bottomInset }]} pointerEvents="box-none">
      <View style={styles.row}>
        <RoundButton
          onPress={toggleMute}
          accessibilityLabel={micEnabled ? "Mute mic" : "Unmute mic"}
          danger={!micEnabled}
        >
          <Ionicons name={micEnabled ? "mic" : "mic-off"} size={20} color={meetingTheme.navy} />
        </RoundButton>

        <RoundButton
          onPress={toggleCamera}
          accessibilityLabel={cameraEnabled ? "Turn camera off" : "Turn camera on"}
          danger={!cameraEnabled}
        >
          <Ionicons
            name={cameraEnabled ? "videocam" : "videocam-off"}
            size={20}
            color={meetingTheme.navy}
          />
        </RoundButton>

        <RoundButton onPress={switchCamera} accessibilityLabel="Flip camera">
          <MaterialCommunityIcons name="camera-switch" size={20} color={meetingTheme.navy} />
        </RoundButton>

        {isTrainer && inClipMode && onToggleLock ? (
          <RoundButton
            onPress={onToggleLock}
            accessibilityLabel={lockMode ? "Unlock clips" : "Lock clips"}
            active={lockMode}
          >
            <Ionicons
              name={lockMode ? "lock-closed" : "lock-open"}
              size={20}
              color={meetingTheme.navy}
            />
          </RoundButton>
        ) : null}

        {isTrainer && inClipMode && onToggleLayout ? (
          <RoundButton onPress={onToggleLayout} accessibilityLabel="Toggle layout">
            <MaterialCommunityIcons
              name="view-split-vertical"
              size={20}
              color={meetingTheme.navy}
            />
          </RoundButton>
        ) : null}

        {isTrainer && inClipMode && onExitClipMode ? (
          <RoundButton onPress={onExitClipMode} accessibilityLabel="Exit clips">
            <Ionicons name="close-circle-outline" size={20} color={meetingTheme.navy} />
          </RoundButton>
        ) : null}

        {isTrainer && !inClipMode && onOpenClipPicker ? (
          <RoundButton onPress={onOpenClipPicker} accessibilityLabel="Clips">
            <MaterialCommunityIcons name="video-vintage" size={20} color={meetingTheme.navy} />
          </RoundButton>
        ) : null}

        {isTrainer && !inClipMode && onToggleDrawing ? (
          <RoundButton
            onPress={onToggleDrawing}
            accessibilityLabel="Draw"
            active={drawingEnabled}
          >
            <MaterialCommunityIcons name="draw" size={20} color={meetingTheme.navy} />
          </RoundButton>
        ) : null}

        {trainerExtras ? (
          <RoundButton onPress={() => setMoreOpen(true)} accessibilityLabel="More actions">
            <Ionicons name="ellipsis-horizontal" size={20} color={meetingTheme.navy} />
          </RoundButton>
        ) : null}

        <RoundButton onPress={hangUp} accessibilityLabel="End call" danger large>
          <Ionicons name="call" size={22} color="#fff" />
        </RoundButton>
      </View>

      <Modal visible={moreOpen} transparent animationType="fade">
        <Pressable style={styles.moreBackdrop} onPress={() => setMoreOpen(false)}>
          <View style={styles.moreSheet}>
            {onScreenshot ? (
              <Pressable
                style={styles.moreRow}
                onPress={() => {
                  setMoreOpen(false);
                  onScreenshot();
                }}
              >
                <Ionicons name="camera-outline" size={20} color={meetingTheme.navy} />
                <Text style={styles.moreText}>Screenshot</Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Modal>
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
        pressed && { opacity: 0.8 },
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
    zIndex: 38,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: meetingTheme.barBg,
    borderWidth: 1,
    borderColor: meetingTheme.barBorder,
    gap: 8,
    shadowColor: meetingTheme.pipShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  btn: {
    width: BTN,
    height: BTN,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: meetingTheme.surface,
  },
  btnLarge: {
    width: BTN_END,
    height: BTN_END,
    backgroundColor: meetingTheme.danger,
    transform: [{ rotate: "135deg" }],
  },
  btnDefault: {},
  btnDanger: {
    backgroundColor: meetingTheme.danger,
  },
  btnActive: {
    backgroundColor: "rgba(30, 64, 175, 0.15)",
    borderWidth: 1,
    borderColor: meetingTheme.accent,
  },
  moreBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  moreSheet: {
    margin: 16,
    marginBottom: 100,
    backgroundColor: meetingTheme.surfaceElevated,
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: meetingTheme.border,
  },
  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  moreText: {
    fontSize: 16,
    color: meetingTheme.text,
    fontWeight: "600",
  },
});
