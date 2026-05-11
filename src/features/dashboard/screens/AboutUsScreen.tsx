import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, space } from "../../../theme/tokens";

const NAVY = "#000080";

const FEATURES = [
  { icon: "videocam-outline" as const, title: "Live Video Sessions", desc: "HD video calls with screen sharing for immersive coaching experiences." },
  { icon: "calendar-outline" as const, title: "Smart Scheduling", desc: "Flexible booking system — schedule instant or recurring sessions." },
  { icon: "cloud-upload-outline" as const, title: "Clip Sharing", desc: "Upload, share, and review training clips directly in the platform." },
  { icon: "people-outline" as const, title: "Community", desc: "Connect with coaches and learners across every sport and skill." },
  { icon: "wallet-outline" as const, title: "Secure Payments", desc: "Transparent pricing and secure transactions via Stripe." },
  { icon: "trophy-outline" as const, title: "Track Progress", desc: "Session reports and ratings to measure and showcase improvement." },
];

export function AboutUsScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>NetQwix</Text>
        </View>
        <Text style={styles.tagline}>The Platform for Expert Coaching</Text>
        <Text style={styles.description}>
          NetQwix connects athletes and learners with world-class coaches for live,
          personalized training sessions. Whether you are an aspiring professional
          or a dedicated enthusiast, NetQwix brings expert guidance to your screen.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What We Offer</Text>
        {FEATURES.map((feature) => (
          <View key={feature.title} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name={feature.icon} size={22} color={NAVY} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDesc}>{feature.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.missionCard}>
        <Text style={styles.missionTitle}>Our Mission</Text>
        <Text style={styles.missionText}>
          To democratize access to expert coaching by making world-class guidance available
          to everyone, everywhere — through technology that feels as natural as being in the
          same room as your coach.
        </Text>
      </View>

      <View style={styles.versionCard}>
        <Text style={styles.versionText}>NetQwix Mobile App</Text>
        <Text style={styles.versionSub}>© 2024 NetQwix. All rights reserved.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f7fb" },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl },

  hero: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.lg,
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  logoBox: {
    backgroundColor: NAVY,
    borderRadius: radii.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    marginBottom: space.xs,
  },
  logoText: { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: 1 },
  tagline: { fontSize: 16, fontWeight: "700", color: NAVY, textAlign: "center" },
  description: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 22 },

  section: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: space.md },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f3f4f6",
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f4ff",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  featureDesc: { fontSize: 13, color: "#6b7280", marginTop: 2, lineHeight: 18 },

  missionCard: {
    backgroundColor: NAVY,
    borderRadius: radii.md,
    padding: space.lg,
    gap: space.sm,
  },
  missionTitle: { fontSize: 16, fontWeight: "700", color: "#fff" },
  missionText: { fontSize: 14, color: "#bfdbfe", lineHeight: 22 },

  versionCard: {
    alignItems: "center",
    paddingVertical: space.md,
    gap: 4,
  },
  versionText: { fontSize: 13, color: "#6b7280" },
  versionSub: { fontSize: 12, color: "#9ca3af" },
});
