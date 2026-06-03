import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export type ChatDeliveryStatus = "sending" | "sent" | "delivered" | "read" | "failed";

type Props = {
  status?: string;
  pending?: boolean;
  failed?: boolean;
  /** Outgoing (trainer/trainee own) bubbles use light ticks on brand fill. */
  isMine?: boolean;
};

/**
 * WhatsApp-style delivery ticks for 1:1 chat.
 * Single gray/white = sent · double gray = delivered · double blue = read.
 */
export function ChatMessageStatus({ status, pending, failed, isMine = true }: Props) {
  if (failed || status === "failed") {
    return (
      <View style={styles.row}>
        <Ionicons name="alert-circle" size={14} color="#ef4444" />
      </View>
    );
  }

  if (pending || status === "sending") {
    return (
      <View style={styles.row}>
        <ActivityIndicator size={10} color="#94a3b8" />
      </View>
    );
  }

  const sentColor = "#94a3b8";
  const deliveredColor = "#64748b";
  const readColor = "#1976d2";

  if (!status || status === "sent") {
    return (
      <View style={styles.row}>
        <Ionicons name="checkmark" size={15} color={sentColor} />
      </View>
    );
  }

  if (status === "delivered") {
    return (
      <View style={styles.row}>
        <Ionicons name="checkmark-done" size={15} color={deliveredColor} />
      </View>
    );
  }

  if (status === "read") {
    return (
      <View style={styles.row}>
        <Ionicons name="checkmark-done" size={15} color={readColor} />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  row: {
    marginLeft: 3,
    minWidth: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
