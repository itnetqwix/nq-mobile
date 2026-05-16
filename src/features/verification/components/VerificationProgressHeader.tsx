import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, space, typography } from "../../../theme";

type Props = {
  phase: number;
  phaseTotal: number;
  title: string;
  subtitle: string;
  steps: { key: string; label: string; done: boolean; active: boolean }[];
};

export function VerificationProgressHeader({ phase, phaseTotal, title, subtitle, steps }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.phase}>
        Step {phase} of {phaseTotal}
      </Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.track}>
        {steps.map((s) => (
          <View key={s.key} style={styles.stepRow}>
            <View
              style={[
                styles.dot,
                s.done && styles.dotDone,
                s.active && !s.done && styles.dotActive,
              ]}
            />
            <Text
              style={[
                typography.label,
                styles.stepLabel,
                s.active ? styles.stepLabelActive : null,
                s.done ? styles.stepLabelDone : null,
              ]}
            >
              {s.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.lg },
  phase: {
    ...typography.label,
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: space.xs,
  },
  title: { ...typography.titleLg, color: colors.text, marginBottom: space.xs },
  subtitle: { ...typography.bodyMd, color: colors.textMuted, marginBottom: space.md },
  track: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepRow: { flexDirection: "row", alignItems: "center", marginBottom: space.sm },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.neutral300,
    marginRight: space.sm,
  },
  dotActive: { backgroundColor: colors.brand },
  dotDone: { backgroundColor: colors.success },
  stepLabel: { color: colors.textMuted, flex: 1 },
  stepLabelActive: { color: colors.text, fontWeight: "600" },
  stepLabelDone: { color: colors.successText },
});
