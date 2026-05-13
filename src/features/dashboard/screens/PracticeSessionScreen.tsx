import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, space, typography } from "../../../theme";

export function PracticeSessionScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Ionicons name="fitness-outline" size={40} color={colors.brandNavy} />
        <Text style={styles.heroTitle}>Practice Sessions</Text>
        <Text style={styles.heroSub}>
          Solo practice drills and self-review tools to sharpen your skills between coaching sessions.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Coming Soon</Text>
        <Text style={styles.sectionBody}>
          Practice session features are being built out. You will be able to:
        </Text>
        {[
          "Record and review your practice clips",
          "Follow drills assigned by your coach",
          "Track your practice streaks and consistency",
          "Share highlights directly with your trainer",
        ].map((item) => (
          <View key={item} style={styles.bulletRow}>
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
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
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bulletText: { ...typography.bodyMd, color: colors.textSecondary, flex: 1 },
});
