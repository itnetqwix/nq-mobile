import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, space, typography } from "../../../theme";
import type { WizardStep } from "./types";

type Props = {
  step: WizardStep;
  stepNum: number;
  totalSteps: number;
  onGoBack: () => void;
};

export function WizardHeader({ step: _step, stepNum, totalSteps, onGoBack }: Props) {
  /** On the first step, "back" dismisses the wizard, so show Close instead of Back. */
  const isFirstStep = stepNum <= 1;
  return (
    <View style={styles.headerRow}>
      <Pressable onPress={onGoBack} style={styles.headerBtn} hitSlop={12}>
        <Ionicons
          name={isFirstStep ? "close" : "chevron-back"}
          size={22}
          color={colors.brandNavy}
        />
        <Text style={styles.headerBtnText}>{isFirstStep ? "Close" : "Back"}</Text>
      </Pressable>
      <Text style={styles.stepPill}>
        Step {stepNum} of {totalSteps}
      </Text>
      <View style={{ width: 72 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  headerBtn: { flexDirection: "row", alignItems: "center", gap: 4, width: 88 },
  headerBtnText: { ...typography.bodyMd, fontWeight: "600", color: colors.brandNavy },
  stepPill: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textMuted,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    overflow: "hidden",
  },
});
