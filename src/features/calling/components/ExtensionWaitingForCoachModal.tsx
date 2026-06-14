import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onCancelRequest?: () => void;
};

/** Trainee extension blocked until coach reconnects. */
export function ExtensionWaitingForCoachModal({
  visible,
  onDismiss,
  onCancelRequest,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Waiting for coach</Text>
          <Text style={styles.body}>
            Your extension request is on hold until your coach reconnects. The timer stays paused
            while you wait.
          </Text>
          <View style={styles.actions}>
            {onCancelRequest ? (
              <Pressable style={[styles.btn, styles.btnSecondary]} onPress={onCancelRequest}>
                <Text style={styles.btnSecondaryText}>Cancel request</Text>
              </Pressable>
            ) : null}
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onDismiss}>
              <Text style={styles.btnPrimaryText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#1c1c1e",
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "700" },
  body: { color: "#e5e5ea", fontSize: 16, lineHeight: 22 },
  actions: { marginTop: 8, gap: 10 },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  btnSecondary: { backgroundColor: "#2c2c2e" },
  btnPrimary: { backgroundColor: "#0a84ff" },
  btnSecondaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  btnPrimaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
