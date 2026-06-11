import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { WEB_APP_ORIGIN } from "../../../../config/env";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { useAuth } from "../../../auth/context/AuthContext";

type Props = {
  onPressInvite?: () => void;
};

export function ReferFriendsBanner({ onPressInvite }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const { user } = useAuth();

  const handleShare = async () => {
    if (onPressInvite) {
      onPressInvite();
      return;
    }
    const name = String((user as any)?.fullname ?? (user as any)?.name ?? "");
    const refCode = String((user as any)?.referral_code ?? (user as any)?._id ?? "");
    const link = refCode ? `${WEB_APP_ORIGIN}/join?ref=${refCode}` : WEB_APP_ORIGIN;
    const message = t("invite.shareMessage", {
      defaultValue: name
        ? `${name} invited you to join Netqwix — the sports coaching platform! Sign up here: ${link}`
        : `Join me on Netqwix — the sports coaching platform! Sign up here: ${link}`,
      name,
      link,
    });
    try {
      await Share.share({ message, url: link });
    } catch {
      // silently ignore
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.banner, pressed && { opacity: 0.92 }]}
      onPress={handleShare}
      accessibilityRole="button"
      accessibilityLabel={t("invite.inviteFriends", { defaultValue: "Invite Friends" })}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="gift-outline" size={24} color={c.brandNavy} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>
          {t("invite.bannerTitle", { defaultValue: "Invite your friends!" })}
        </Text>
        <Text style={styles.sub} numberOfLines={2}>
          {t("invite.bannerSub", {
            defaultValue: "Share Netqwix with friends and grow your network.",
          })}
        </Text>
      </View>
      <View style={styles.cta}>
        <Text style={styles.ctaText}>
          {t("invite.bannerCta", { defaultValue: "Invite" })}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={c.brandTextOn} />
      </View>
    </Pressable>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      banner: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        padding: space.md,
        borderRadius: radii.lg,
        backgroundColor: palette.brandSubtle,
        borderWidth: 1,
        borderColor: palette.brandAccentSubtle,
      },
      iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.border,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      },
      textWrap: { flex: 1 },
      title: {
        ...typography.bodySm,
        fontWeight: "700",
        color: palette.brandNavy,
      },
      sub: {
        ...typography.caption,
        color: palette.textMuted,
        marginTop: 2,
        lineHeight: 16,
      },
      cta: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.pill,
        backgroundColor: palette.brandNavy,
      },
      ctaText: {
        fontSize: 12,
        fontWeight: "700",
        color: palette.brandTextOn,
      },
    })
  );
}
