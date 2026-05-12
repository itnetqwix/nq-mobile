import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, space } from "../../../theme/tokens";

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
    fontSize: 22,
    fontWeight: "700",
    color: colors.brandNavy,
    textAlign: "center",
  },
  trainerLine: { fontSize: 15, color: colors.textMuted, textAlign: "center", marginBottom: space.md },
  trainerName: { fontWeight: "700", color: colors.text },
});
