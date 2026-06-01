import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { meetingTheme } from "../meetingTheme";

export type TrainerOverflowAction =
  | "screenshot"
  | "gallery"
  | "lock"
  | "audio"
  | "record";

type MenuItem = {
  id: TrainerOverflowAction;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  active?: boolean;
};

type Props = {
  items: MenuItem[];
  onSelect: (id: TrainerOverflowAction) => void;
  disabled?: boolean;
};

/** Google Meet–style ⋮ menu for secondary trainer controls. */
export function MeetingTrainerOverflowMenu({ items, onSelect, disabled }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        style={({ pressed }) => [
          styles.trigger,
          pressed && { opacity: 0.85 },
          disabled && { opacity: 0.4 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="More options"
      >
        <Ionicons name="ellipsis-vertical" size={18} color={meetingTheme.text} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            {items.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.row, item.disabled && styles.rowDisabled]}
                disabled={item.disabled}
                onPress={() => {
                  setOpen(false);
                  onSelect(item.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={item.active ? meetingTheme.navy : meetingTheme.text}
                />
                <Text style={[styles.rowLabel, item.active && styles.rowLabelActive]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: meetingTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: meetingTheme.border,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 100,
    paddingRight: 12,
  },
  menu: {
    minWidth: 220,
    backgroundColor: meetingTheme.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: meetingTheme.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: meetingTheme.border,
  },
  rowDisabled: { opacity: 0.45 },
  rowLabel: { fontSize: 15, color: meetingTheme.text, fontWeight: "500" },
  rowLabelActive: { fontWeight: "700", color: meetingTheme.navy },
});
