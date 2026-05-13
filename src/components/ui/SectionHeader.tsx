import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, space, typography } from "../../theme";

export type SectionHeaderProps = {
  label: string;
  trailing?: React.ReactNode;
};

/** Uppercase "PAGES", "TOOLS", etc. row dividers between sections. */
export function SectionHeader({ label, trailing }: SectionHeaderProps) {
  return (
    <View style={styles.wrap}>
      <Text style={[typography.overline, { color: colors.textMuted }]}>
        {label}
      </Text>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.xs,
  },
  trailing: { marginLeft: "auto" },
});
