import React from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { Button } from "../../../components/ui";
import { space, typography, useThemedStyles, useThemeColors } from "../../../theme";

type Props = {
  visible: boolean;
  message?: string | null;
  onExit: () => void;
};

/** Shown when this device lost the lesson call slot to another device. */
export function CallSlotTakenOverModal({
  visible,
  message,
  onExit,
}: Props) {
  const c = useThemeColors();
  const styles = useStyles();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: c.surfaceElevated }]}>
          <Text style={[styles.title, { color: c.text }]}>Lesson moved</Text>
          <Text style={[styles.body, { color: c.textMuted }]}>
            {message ??
              "This lesson was continued on another device. Return to your schedule to rejoin if needed."}
          </Text>
          <Button label="OK" onPress={onExit} fullWidth />
        </View>
      </View>
    </Modal>
  );
}

function useStyles() {
  return useThemedStyles(() =>
    StyleSheet.create({
      backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.55)",
        justifyContent: "center",
        padding: space.lg,
      },
      card: {
        borderRadius: 16,
        padding: space.lg,
        gap: space.md,
      },
      title: { ...typography.titleMd, fontWeight: "800" },
      body: { ...typography.bodyMd, lineHeight: 22 },
    })
  );
}
