import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../../components/ui/Screen";
import { colors, space } from "../../../theme/tokens";
import type { MainTabScreenProps } from "../../../navigation/types";

/**
 * Parity target: `nq-frontend-main` `/dashboard/chats` (messenger / threads).
 */
export function ChatsScreen(_props: MainTabScreenProps<"Chats">) {
  return (
    <Screen scroll>
      <View style={styles.box}>
        <Text style={styles.title}>Chats</Text>
        <Text style={styles.body}>
          This tab maps to the web “Chats” area. Implementation will reuse the same conversation
          endpoints as the website, optimized for mobile lists and push-friendly read state.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingVertical: space.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    marginBottom: space.md,
  },
  body: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
  },
});
