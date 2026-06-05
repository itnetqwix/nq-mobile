import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  durations,
  easings,
  radii,
  space,
  themedShadow,
  typography,
  useTheme,
  useThemeColors,
  useThemedStyles,
} from "../../theme";

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  /** Optional dismiss icon top-right. */
  showClose?: boolean;
  /** Stretch sheet to almost full height (used for forms). */
  fullHeight?: boolean;
  contentStyle?: ViewStyle;
};

/**
 * Native bottom sheet built on `Modal`. Adds a slide-up animation, dimmed
 * backdrop, and an optional header. For very simple confirms reach for
 * `Alert` instead; this is meant for inline content/forms.
 */
export function Sheet({
  visible,
  onClose,
  title,
  description,
  children,
  showClose,
  fullHeight,
  contentStyle,
}: SheetProps) {
  const translateY = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();
  const isDark = scheme === "dark";
  const palette = useThemeColors();

  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      backdrop: {
        flex: 1,
        backgroundColor: c.scrim,
        justifyContent: "flex-end",
      },
      sheet: {
        backgroundColor: c.surfaceElevated,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        paddingTop: space.sm,
        paddingHorizontal: space.lg,
        ...(Platform.OS === "ios" ? themedShadow("xl", isDark) : { elevation: 12 }),
      },
      sheetTall: { minHeight: "70%" },
      handle: {
        alignSelf: "center",
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: c.neutral300,
        marginBottom: space.sm,
      },
      header: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space.sm,
        paddingBottom: space.sm,
      },
      title: { ...typography.titleMd, color: c.text },
      description: { ...typography.bodySm, color: c.textMuted, marginTop: 4 },
      closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: c.surfaceMuted,
        alignItems: "center",
        justifyContent: "center",
      },
      body: { paddingTop: space.xs },
    })
  );

  useEffect(() => {
    if (!visible) {
      translateY.setValue(40);
      opacity.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: durations.base,
        easing: easings.decelerate,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: durations.base,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, translateY, opacity]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            fullHeight && styles.sheetTall,
            {
              transform: [{ translateY }],
              opacity,
              paddingBottom: Math.max(space.lg, insets.bottom + space.sm),
            },
          ]}
        >
          <View style={styles.handle} />
          {(title || showClose) && (
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                {title ? <Text style={styles.title}>{title}</Text> : null}
                {description ? <Text style={styles.description}>{description}</Text> : null}
              </View>
              {showClose ? (
                <Pressable
                  onPress={onClose}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={20} color={palette.text} />
                </Pressable>
              ) : null}
            </View>
          )}
          <View style={[styles.body, contentStyle]}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}
