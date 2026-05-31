import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { HomeStackParamList } from "../../../navigation/types";
import { colors, radii, space, typography } from "../../../theme";

export function PracticeSessionScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Ionicons name="fitness-outline" size={40} color={colors.brandNavy} />
        <Text style={styles.heroTitle}>Practice Sessions</Text>
        <Text style={styles.heroSub}>
          Solo practice drills and self-review between coaching sessions. Full guided practice
          flows are on the roadmap.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available now</Text>
        <Text style={styles.sectionBody}>
          Use your clip library to record, review, and share practice footage with your trainer.
        </Text>
        <Pressable
          style={styles.actionBtn}
          onPress={() => navigation.navigate("ShellSurface", { surfaceId: "clips" })}
        >
          <Ionicons name="videocam-outline" size={20} color={colors.brandTextOn} />
          <Text style={styles.actionBtnText}>Open My Clips</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.actionBtnSecondary]}
          onPress={() => navigation.navigate("ShellSurface", { surfaceId: "clipSubmissions" })}
        >
          <Ionicons name="cloud-upload-outline" size={20} color={colors.brandNavy} />
          <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>
            Submit to library
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Coming soon</Text>
        {[
          "Coach-assigned practice drills",
          "Practice streaks and consistency tracking",
          "In-app solo recording with instant replay",
        ].map((item) => (
          <View key={item} style={styles.bulletRow}>
            <Ionicons name="ellipse-outline" size={14} color={colors.textMuted} />
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl },

  heroCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.lg,
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroTitle: { ...typography.titleMd, color: colors.brandNavy },
  heroSub: { ...typography.bodyMd, color: colors.textMuted, textAlign: "center" },

  section: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { ...typography.titleSm, color: colors.text },
  sectionBody: { ...typography.bodyMd, color: colors.textMuted },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brandNavy,
    paddingVertical: 12,
    borderRadius: radii.md,
    marginTop: space.xs,
  },
  actionBtnSecondary: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnText: { color: colors.brandTextOn, fontWeight: "700", fontSize: 15 },
  actionBtnTextSecondary: { color: colors.brandNavy },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bulletText: { ...typography.bodyMd, color: colors.textSecondary, flex: 1 },
});
