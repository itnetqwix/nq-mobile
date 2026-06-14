import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "../../../lib/haptics";
import { colors, radii, space, typography } from "../../../theme";

export type CapturedShareTarget = "my-clips" | "friends" | "email";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (target: CapturedShareTarget) => void;
};

const OPTIONS: {
  id: CapturedShareTarget;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}[] = [
  {
    id: "my-clips",
    icon: "folder-outline",
    title: "My Clips library",
    subtitle: "Upload and save to your locker",
  },
  {
    id: "friends",
    icon: "people-outline",
    title: "NetQwix friends",
    subtitle: "Share with people you know on NetQwix",
  },
  {
    id: "email",
    icon: "mail-outline",
    title: "Invite by email",
    subtitle: "Send to someone who is not on NetQwix yet",
  },
];

export function CapturedShareSheet({ visible, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.md) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Share captured clip</Text>
          <Text style={styles.lead}>Choose where this clip should go after upload.</Text>

          {OPTIONS.map((opt) => (
            <Pressable
              key={opt.id}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
              onPress={() => {
                haptics.select();
                onSelect(opt.id);
                onClose();
              }}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={opt.icon} size={22} color={colors.brandNavy} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>{opt.title}</Text>
                <Text style={styles.rowSub}>{opt.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </Pressable>
          ))}

          <Pressable style={styles.cancelBtn} onPress={onClose}>
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
    backgroundColor: "#fff",
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
    marginBottom: space.md,
  },
  title: { ...typography.subtitle, color: "#111827", marginBottom: 4 },
  lead: { ...typography.bodySm, color: "#6b7280", marginBottom: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  rowSub: { fontSize: 12, color: "#6b7280", marginTop: 2, lineHeight: 16 },
  cancelBtn: {
    marginTop: space.md,
    alignItems: "center",
    paddingVertical: space.sm,
  },
  cancelText: { fontSize: 15, fontWeight: "600", color: colors.brandNavy },
});
