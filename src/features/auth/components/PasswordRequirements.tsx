import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { radii, space, typography, useThemeColors } from "../../../theme";
import { SIGNUP_PASSWORD_RULES } from "../utils/passwordValidation";

type Props = {
  password: string;
};

export function PasswordRequirements({ password }: Props) {
  const c = useThemeColors();
  return (
    <View style={[styles.box, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
      <Text style={[styles.title, { color: c.text }]}>Password must include:</Text>
      {SIGNUP_PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <View key={rule.id} style={styles.row}>
            <Ionicons
              name={ok ? "checkmark-circle" : "ellipse-outline"}
              size={18}
              color={ok ? c.success : c.textMuted}
            />
            <Text style={[styles.rule, { color: ok ? c.text : c.textMuted }]}>{rule.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: space.md,
    gap: space.sm,
  },
  title: { ...typography.label, fontWeight: "600", marginBottom: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  rule: { ...typography.bodySm, flex: 1 },
});
