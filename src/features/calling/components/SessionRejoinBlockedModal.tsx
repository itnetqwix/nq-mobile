import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  visible: boolean;
  reason: string;
  onDismiss: () => void;
};

/** Shown when trainer schedule blocks rejoin after partner stayed. */
export function SessionRejoinBlockedModal({ visible, reason, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Cannot rejoin</Text>
          <Text style={styles.body}>{reason}</Text>
          <Text style={styles.hint}>
            Your partner chose to stay in the session, but another booking blocks your return.
            Contact support if you need help.
          </Text>
          <Pressable style={styles.btn} onPress={onDismiss}>
            <Text style={styles.btnText}>OK</Text>
          </Pressable>
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
  hint: { color: "#8e8e93", fontSize: 14, lineHeight: 20 },
  btn: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#2c2c2e",
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
