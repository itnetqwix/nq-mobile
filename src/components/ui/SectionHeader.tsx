import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { space, typography, useThemeColors, useThemedStyles } from "../../theme";

export type SectionHeaderProps = {
  label: string;
  trailing?: React.ReactNode;
};

/** Uppercase "PAGES", "TOOLS", etc. row dividers between sections. */
export function SectionHeader({ label, trailing }: SectionHeaderProps) {
  const c = useThemeColors();
  const styles = useThemedStyles(() =>
    StyleSheet.create({
      wrap: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: space.md,
        paddingTop: space.md,
        paddingBottom: space.xs,
      },
      trailing: { marginLeft: "auto" },
    })
  );

  return (
    <View style={styles.wrap}>
      <Text style={[typography.overline, { color: c.textMuted }]}>
        {label}
      </Text>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}
