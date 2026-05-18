import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  dismissPostLessonConcern,
  isPostLessonConcernDismissed,
} from "./postLessonConcernDismissStore";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../navigation/types";
import { colors, radii, space, typography } from "../../../theme";

type Props = {
  sessionId: string;
  otherPartyName?: string;
};

export function PostLessonConcernBanner({ sessionId, otherPartyName }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [dismissed, setDismissed] = useState(() => isPostLessonConcernDismissed(sessionId));

  const dismiss = useCallback(() => {
    dismissPostLessonConcern(sessionId);
    setDismissed(true);
  }, [sessionId]);

  const openReport = () => {
    navigation.navigate("Main", {
      screen: "Tabs",
      params: {
        screen: "Home",
        params: {
          screen: "ShellSurface",
          params: { surfaceId: "reportIssue", sessionId },
        },
      },
    } as never);
  };

  if (dismissed) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.textCol}>
        <Text style={styles.title}>How was your lesson?</Text>
        <Text style={styles.sub}>
          Report an issue from your session{otherPartyName ? ` with ${otherPartyName}` : ""}.
        </Text>
      </View>
      <Pressable style={styles.cta} onPress={openReport}>
        <Text style={styles.ctaText}>Report</Text>
      </Pressable>
      <Pressable onPress={dismiss} hitSlop={8} accessibilityLabel="Dismiss">
        <Ionicons name="close" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginHorizontal: space.md,
    marginBottom: space.md,
    padding: space.md,
    borderRadius: radii.md,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  textCol: { flex: 1 },
  title: { ...typography.bodyMd, fontWeight: "700", color: colors.text },
  sub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  cta: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.brandNavy,
  },
  ctaText: { ...typography.caption, fontWeight: "700", color: colors.brandTextOn },
});
