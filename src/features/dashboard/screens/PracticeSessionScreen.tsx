import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, space } from "../../../theme/tokens";

const NAVY = "#000080";

export function PracticeSessionScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Ionicons name="fitness-outline" size={40} color={NAVY} />
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
            <Ionicons name="checkmark-circle-outline" size={16} color="#16a34a" />
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f7fb" },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl },

  heroCard: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.lg,
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  heroTitle: { fontSize: 20, fontWeight: "700", color: NAVY },
  heroSub: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },

  section: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.md,
    gap: space.sm,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  sectionBody: { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bulletText: { fontSize: 14, color: "#374151", flex: 1, lineHeight: 20 },
});
