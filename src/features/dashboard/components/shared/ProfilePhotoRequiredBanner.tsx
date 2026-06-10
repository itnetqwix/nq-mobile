import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";

type Props = {
  onAddPhoto: () => void;
};

/**
 * Prominent, non-dismissable banner shown on both the trainer and trainee
 * dashboard when the user has not yet set a profile photo.
 * It disappears automatically once `user.profile_picture` is populated.
 */
export function ProfilePhotoRequiredBanner({ onAddPhoto }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="camera" size={28} color={c.brandNavy} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>
          {t("profile.photoRequired.title", { defaultValue: "Add your profile photo" })}
        </Text>
        <Text style={styles.body}>
          {t("profile.photoRequired.body", {
            defaultValue:
              "A profile photo is required to appear in search results and build trust with the community.",
          })}
        </Text>
      </View>
      <Pressable
        onPress={onAddPhoto}
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.82 }]}
        accessibilityRole="button"
        accessibilityLabel={t("profile.photoRequired.cta", { defaultValue: "Add photo" })}
      >
        <Ionicons name="camera-outline" size={16} color="#fff" />
        <Text style={styles.ctaText}>
          {t("profile.photoRequired.cta", { defaultValue: "Add photo" })}
        </Text>
      </Pressable>
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      container: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        backgroundColor: palette.brandSubtle,
        borderWidth: 1.5,
        borderColor: palette.brandNavy,
        borderRadius: radii.lg,
        padding: space.md,
      },
      iconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.brandNavy,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      },
      textWrap: { flex: 1, minWidth: 0 },
      title: {
        ...typography.label,
        color: palette.text,
        fontWeight: "700",
        fontSize: 13,
        marginBottom: 3,
      },
      body: {
        ...typography.caption,
        color: palette.textMuted,
        lineHeight: 16,
      },
      cta: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: palette.brandNavy,
        borderRadius: radii.md,
        paddingHorizontal: space.sm,
        paddingVertical: 8,
        flexShrink: 0,
      },
      ctaText: {
        ...typography.caption,
        color: "#fff",
        fontWeight: "700",
        fontSize: 12,
      },
    })
  );
}
