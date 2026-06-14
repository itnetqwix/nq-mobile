import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { NetqwixLogo } from "../../../components/brand/NetqwixLogo";
import { ScreenContainer } from "../../../components/ui";
import { space, typography, useThemeColors } from "../../../theme";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  style?: ViewStyle;
};

export function AuthScreenLayout({ title, subtitle, children, footer, style }: Props) {
  const c = useThemeColors();
  const styles = StyleSheet.create({
    brand: { alignItems: "center", width: "100%" },
    title: { ...typography.titleLg, color: c.text, marginTop: space.md, textAlign: "center" },
    subtitle: {
      ...typography.bodyMd,
      color: c.textMuted,
      marginTop: space.xs,
      marginBottom: space.md,
      textAlign: "center",
      lineHeight: 22,
    },
    card: {
      backgroundColor: c.surfaceElevated,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: space.lg,
    },
    footer: { marginTop: space.lg },
    scrollContent: { flexGrow: 1 },
  });

  return (
    <ScreenContainer
      scroll
      dismissKeyboardOnTap
      applyTopInset={false}
      applyBottomInset={false}
      padding="lg"
      background={c.background}
      style={style}
      contentStyle={styles.scrollContent}
    >
      <View style={styles.brand}>
        <NetqwixLogo variant="wordmark" fullWidth maxWidth={340} height={88} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      <View style={styles.card}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </ScreenContainer>
  );
}
