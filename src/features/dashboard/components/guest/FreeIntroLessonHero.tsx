import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { haptics } from "../../../../lib/haptics";
import { radii, space, typography, useThemeColors } from "../../../../theme";

type Props = {
  onPress: () => void;
};

/**
 * Marketplace-style hero shown to guests. "First lesson on us" is the
 * highest-converting CTA we have for unsigned users, so it gets the most
 * visible card above the trainer feed.
 */
export function FreeIntroLessonHero({ onPress }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();

  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.root,
        {
          backgroundColor: c.brandNavy,
          shadowColor: c.brandNavy,
        },
        pressed && { opacity: 0.92, transform: [{ scale: 0.995 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={t("guest.hero.freeIntroCta")}
    >
      <View style={[styles.eyebrowPill, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
        <Ionicons name="sparkles" size={12} color="#fff" />
        <Text style={styles.eyebrow}>{t("guest.hero.freeIntroEyebrow")}</Text>
      </View>
      <Text style={styles.title}>{t("guest.hero.freeIntroTitle")}</Text>
      <Text style={styles.body}>{t("guest.hero.freeIntroBody")}</Text>
      <View style={styles.ctaRow}>
        <View style={[styles.cta, { backgroundColor: "#fff" }]}>
          <Text style={[styles.ctaText, { color: c.brandNavy }]}>
            {t("guest.hero.freeIntroCta")}
          </Text>
          <Ionicons name="arrow-forward" size={16} color={c.brandNavy} />
        </View>
      </View>
      <View style={styles.decorOne} />
      <View style={styles.decorTwo} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radii.lg,
    padding: space.lg,
    overflow: "hidden",
    position: "relative",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    marginBottom: space.md,
  },
  eyebrowPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: space.sm,
  },
  eyebrow: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 1 },
  title: {
    ...typography.titleLg,
    color: "#fff",
    fontWeight: "800",
    marginBottom: 6,
  },
  body: {
    color: "rgba(255,255,255,0.86)",
    lineHeight: 21,
    fontSize: 14,
    maxWidth: 320,
  },
  ctaRow: { flexDirection: "row", marginTop: space.md },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
  },
  ctaText: { fontWeight: "800", fontSize: 14 },
  decorOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.07)",
    right: -50,
    top: -60,
  },
  decorTwo: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.06)",
    right: 30,
    bottom: -30,
  },
});
