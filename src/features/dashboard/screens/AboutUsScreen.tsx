import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";

const FEATURES = [
  { icon: "videocam-outline" as const, title: "Live Video Sessions", desc: "HD video calls with screen sharing for immersive coaching experiences." },
  { icon: "calendar-outline" as const, title: "Smart Scheduling", desc: "Flexible booking system — schedule instant or recurring sessions." },
  { icon: "cloud-upload-outline" as const, title: "Clip Sharing", desc: "Upload, share, and review training clips directly in the platform." },
  { icon: "people-outline" as const, title: "Community", desc: "Connect with coaches and learners across every sport and skill." },
  { icon: "wallet-outline" as const, title: "Secure Payments", desc: "Transparent pricing and secure transactions via Stripe." },
  { icon: "trophy-outline" as const, title: "Track Progress", desc: "Session reports and ratings to measure and showcase improvement." },
];

export function AboutUsScreen() {
  const c = useThemeColors();
  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: palette.background },
      content: { padding: space.md, gap: space.md, paddingBottom: space.xl },
      hero: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.md,
        padding: space.lg,
        alignItems: "center",
        gap: space.sm,
        borderWidth: 1,
        borderColor: palette.border,
      },
      logoBox: {
        backgroundColor: palette.brandNavy,
        borderRadius: radii.sm,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
        marginBottom: space.xs,
      },
      logoText: { fontSize: 22, fontWeight: "800", color: palette.brandTextOn, letterSpacing: 1 },
      tagline: { ...typography.titleSm, color: palette.iconPrimary, textAlign: "center" },
      description: { ...typography.bodyMd, color: palette.textMuted, textAlign: "center" },
      section: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.md,
        padding: space.md,
        borderWidth: 1,
        borderColor: palette.border,
      },
      sectionTitle: { ...typography.titleSm, color: palette.text, marginBottom: space.md },
      featureRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space.md,
        paddingVertical: space.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
      },
      featureIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: palette.brandSubtle,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      },
      featureText: { flex: 1 },
      featureTitle: { ...typography.subtitle, color: palette.text },
      featureDesc: { ...typography.bodySm, color: palette.textMuted, marginTop: 2 },
      missionCard: {
        backgroundColor: palette.brandNavy,
        borderRadius: radii.md,
        padding: space.lg,
        gap: space.sm,
      },
      missionTitle: { ...typography.titleSm, color: palette.brandTextOn },
      missionText: { ...typography.bodyMd, color: palette.brandSubtle },
      versionCard: { alignItems: "center", paddingVertical: space.md, gap: 4 },
      versionText: { ...typography.bodySm, color: palette.textMuted },
      versionSub: { ...typography.caption, color: palette.textMuted },
    })
  );

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
              <Ionicons name={feature.icon} size={22} color={c.iconPrimary} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDesc}>{feature.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How it works</Text>
        <Text style={styles.description}>
          1. Trainees book instant or scheduled lessons with verified coaches.{"\n"}
          2. Both join the native video room — review clips, draw, and record progress.{"\n"}
          3. Coaches deliver game plans and feedback stored in your locker.
        </Text>
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
