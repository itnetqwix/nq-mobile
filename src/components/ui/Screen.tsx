import React from "react";
import { ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { space, useThemedStyles } from "../../theme";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
};

export function Screen({ children, scroll, contentStyle }: Props) {
  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      safe: { flex: 1, backgroundColor: c.background },
      fill: { flex: 1, paddingHorizontal: space.lg },
      scrollContent: {
        flexGrow: 1,
        paddingHorizontal: space.lg,
        paddingBottom: space.xl,
      },
    })
  );

  if (scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "right", "bottom", "left"]}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={[styles.safe, contentStyle]} edges={["top", "right", "bottom", "left"]}>
      <View style={styles.fill}>{children}</View>
    </SafeAreaView>
  );
}
