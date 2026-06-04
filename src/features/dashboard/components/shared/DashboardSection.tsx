import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { space, typography, useThemedStyles } from "../../../../theme";

type Props = {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
  /** Parent stack controls vertical gap (trainer hub). */
  embedded?: boolean;
};

export function DashboardSection({
  title,
  subtitle,
  action,
  children,
  style,
  testID,
  embedded,
}: Props) {
  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      root: { marginBottom: embedded ? 0 : space.md },
      head: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: subtitle ? 0 : space.sm,
        gap: space.sm,
      },
      title: { ...typography.titleSm, color: palette.text, fontWeight: "700", flex: 1 },
      subtitle: {
        ...typography.caption,
        color: palette.textMuted,
        marginTop: space.xs,
        marginBottom: space.sm,
      },
    })
  );

  return (
    <View style={[styles.root, style]} testID={testID}>
      {!!title && (
        <View style={styles.head}>
          <Text style={styles.title}>{title}</Text>
          {action}
        </View>
      )}
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {children}
    </View>
  );
}
