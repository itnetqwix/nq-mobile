import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FormField } from "../../../components/ui";
import { space, typography, useThemeColors } from "../../../theme";

type Props = {
  title: string;
  onRemove: () => void;
  children: React.ReactNode;
};

export function CredentialRowEditor({ title, onRemove, children }: Props) {
  const c = useThemeColors();
  return (
    <View style={[styles.card, { borderColor: c.border, backgroundColor: c.surfaceElevated }]}>
      <View style={styles.header}>
        <Text style={[typography.label, { color: c.text }]}>{title}</Text>
        <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button">
          <Ionicons name="trash-outline" size={20} color={c.danger} />
        </Pressable>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: space.md,
    marginBottom: space.md,
    gap: space.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.xs,
  },
});

export function CredentialTextField(props: React.ComponentProps<typeof FormField>) {
  return <FormField {...props} />;
}
