import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space, typography, useThemeColors, useThemedStyles } from "../../theme";

export type HeaderAction = {
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  onPress: () => void;
  accessibilityLabel?: string;
  badge?: number;
};

export type HeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Custom left element (overrides back button). */
  left?: React.ReactNode;
  /** Right-aligned action buttons. */
  actions?: HeaderAction[];
  /** Hide bottom hairline, e.g. for hero screens. */
  hideDivider?: boolean;
  /** Use a transparent background — combine with a hero gradient below. */
  transparent?: boolean;
  /** Skip safe-area top padding (e.g. when inside a modal). */
  skipTopInset?: boolean;
  style?: ViewStyle;
};

/**
 * Shared screen header. Stacks title + subtitle and supports a back button
 * plus up to ~3 right actions. Use whenever a screen needs its own chrome
 * (i.e. anywhere we previously hand-rolled a `View` with `style={{ flexDirection: "row" }}`).
 */
export function Header({
  title,
  subtitle,
  onBack,
  left,
  actions,
  hideDivider,
  transparent,
  skipTopInset,
  style,
}: HeaderProps) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const topPad = skipTopInset ? 0 : insets.top;
  const styles = useThemedStyles((colors) =>
    StyleSheet.create({
      wrap: {
        flexDirection: "row",
        alignItems: "center",
        paddingBottom: space.sm,
        borderBottomColor: colors.border,
        gap: space.xs,
      },
      leftBlock: { width: 44, alignItems: "flex-start", justifyContent: "center" },
      actionsBlock: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        minWidth: 44,
        gap: space.xs,
      },
      titleBlock: { flex: 1, alignItems: "center", justifyContent: "center" },
      title: { textAlign: "center" },
      subtitle: { color: colors.textMuted, marginTop: 2, textAlign: "center" },
      iconBtn: {
        flexDirection: "row",
        alignItems: "center",
        height: 36,
        paddingHorizontal: space.xs,
        borderRadius: 18,
      },
      badge: {
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: colors.danger,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 4,
        marginLeft: 4,
      },
      badgeText: {
        color: colors.brandTextOn,
        fontSize: 10,
        fontWeight: "700",
      },
    })
  );

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: topPad + (Platform.OS === "android" ? space.xs : space.xxs),
          paddingLeft: space.sm + insets.left,
          paddingRight: space.sm + insets.right,
          backgroundColor: transparent ? "transparent" : c.surface,
          borderBottomWidth: hideDivider ? 0 : StyleSheet.hairlineWidth,
        },
        style,
      ]}
    >
      <View style={styles.leftBlock}>
        {left ?? (onBack ? <BackButton onPress={onBack} /> : null)}
      </View>

      <View style={styles.titleBlock} pointerEvents="none">
        <Text style={[typography.titleSm, styles.title]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[typography.caption, styles.subtitle]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.actionsBlock}>
        {(actions ?? []).map((a, idx) => (
          <ActionBtn key={idx} action={a} />
        ))}
      </View>
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const c = useThemeColors();
  const styles = useThemedStyles(() =>
    StyleSheet.create({
      iconBtn: {
        flexDirection: "row",
        alignItems: "center",
        height: 36,
        paddingHorizontal: space.xs,
        borderRadius: 18,
      },
    })
  );

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name="chevron-back" size={24} color={c.text} />
    </Pressable>
  );
}

function ActionBtn({ action }: { action: HeaderAction }) {
  const c = useThemeColors();
  const styles = useThemedStyles((colors) =>
    StyleSheet.create({
      iconBtn: {
        flexDirection: "row",
        alignItems: "center",
        height: 36,
        paddingHorizontal: space.xs,
        borderRadius: 18,
      },
      badge: {
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: colors.danger,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 4,
        marginLeft: 4,
      },
      badgeText: {
        color: colors.brandTextOn,
        fontSize: 10,
        fontWeight: "700",
      },
    })
  );

  return (
    <Pressable
      onPress={action.onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel ?? action.label ?? "Header action"}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
    >
      {action.icon ? <Ionicons name={action.icon} size={22} color={c.text} /> : null}
      {action.label ? (
        <Text style={[typography.label, { color: c.text, marginLeft: 4 }]}>
          {action.label}
        </Text>
      ) : null}
      {typeof action.badge === "number" && action.badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{action.badge > 99 ? "99+" : action.badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
