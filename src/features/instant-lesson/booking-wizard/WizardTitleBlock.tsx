import React from "react";
import { StyleSheet, Text } from "react-native";
import { colors, space, typography } from "../../../theme";

type Props = {
  trainerName: string;
};

export function WizardTitleBlock({ trainerName }: Props) {
  return (
    <>
      <Text style={styles.screenTitle}>Book instant lesson</Text>
      <Text style={styles.trainerLine}>
        with <Text style={styles.trainerName}>{trainerName}</Text>
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    ...typography.titleLg,
    color: colors.brandNavy,
    textAlign: "center",
  },
  trainerLine: { ...typography.subtitle, color: colors.textMuted, textAlign: "center", marginBottom: space.md },
  trainerName: { fontWeight: "700", color: colors.text },
});
