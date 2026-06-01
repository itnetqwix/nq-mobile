import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { meetingTheme } from "../meetingTheme";

export type ScreenshotCaptureChoice =
  | "stage"
  | "clip0"
  | "clip1"
  | "bothClips";

type Props = {
  visible: boolean;
  clipLabels?: [string, string];
  hasDualClips: boolean;
  inLiveFocus?: boolean;
  onClose: () => void;
  onSelect: (choice: ScreenshotCaptureChoice) => void;
};

export function ScreenshotCapturePickerModal({
  visible,
  clipLabels = ["Clip 1", "Clip 2"],
  hasDualClips,
  inLiveFocus,
  onClose,
  onSelect,
}: Props) {
  const insets = useSafeAreaInsets();

  const options: { id: ScreenshotCaptureChoice; label: string; sub?: string; icon: keyof typeof Ionicons.glyphMap }[] =
    [];

  if (hasDualClips) {
    options.push(
      {
        id: "bothClips",
        label: "Both clips",
        sub: "Stacked frame — matches dual-clip view",
        icon: "copy-outline",
      },
      {
        id: "clip0",
        label: clipLabels[0],
        sub: "Top clip at current time",
        icon: "film-outline",
      },
      {
        id: "clip1",
        label: clipLabels[1],
        sub: "Bottom clip at current time",
        icon: "film-outline",
      }
    );
  } else if (!inLiveFocus) {
    options.push({
      id: "clip0",
      label: "Current clip",
      sub: "Frame at playback position",
      icon: "film-outline",
    });
  }

  options.push({
    id: "stage",
    label: inLiveFocus ? "Live video" : "What's on screen",
    sub: "Captures the visible lesson view",
    icon: "scan-outline",
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Capture screenshot</Text>
          <Text style={styles.sub}>
            Choose what to include in the game plan for this moment.
          </Text>
          {options.map((opt) => (
            <Pressable
              key={opt.id}
              style={styles.row}
              onPress={() => {
                onSelect(opt.id);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
            >
              <Ionicons name={opt.icon} size={22} color={meetingTheme.navy} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{opt.label}</Text>
                {opt.sub ? <Text style={styles.rowSub}>{opt.sub}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={meetingTheme.textMuted} />
            </Pressable>
          ))}
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: meetingTheme.surfaceElevated,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: meetingTheme.border,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: meetingTheme.text,
  },
  sub: {
    fontSize: 13,
    color: meetingTheme.textMuted,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: meetingTheme.border,
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: "600", color: meetingTheme.text },
  rowSub: { fontSize: 12, color: meetingTheme.textMuted, marginTop: 2 },
  cancel: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelText: { fontSize: 15, fontWeight: "600", color: meetingTheme.textMuted },
});
