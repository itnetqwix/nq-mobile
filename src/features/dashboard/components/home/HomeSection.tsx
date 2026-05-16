import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Card } from "../../../../components/ui";
import { radii, space, typography, useThemedStyles } from "../../../../theme";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  testID?: string;
  /** Optional right-side header action (e.g. badge) */
  headerRight?: React.ReactNode;
  style?: ViewStyle;
  /** Skip inner card wrapper for custom layouts (horizontal lists) */
  bare?: boolean;
};

export function HomeSection({
  title,
  subtitle,
  children,
  testID,
  headerRight,
  style,
  bare,
}: Props) {
  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      wrap: { marginBottom: space.md },
      header: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: space.sm,
        gap: space.sm,
      },
      headerText: { flex: 1, minWidth: 0 },
      title: { ...typography.titleSm, color: palette.text, fontWeight: "700" },
      subtitle: {
        ...typography.bodySm,
        color: palette.textMuted,
        marginTop: 2,
      },
      body: { overflow: "hidden", borderRadius: radii.lg },
    })
  );

  return (
    <View style={[styles.wrap, style]} testID={testID}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {headerRight}
      </View>
      {bare ? (
        children
      ) : (
        <Card variant="outlined" padding={0} style={styles.body}>
          {children}
        </Card>
      )}
    </View>
  );
}
