import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button } from "../../../../components/ui";
import { AccountType } from "../../../../constants/accountType";
import { WEB_APP_ORIGIN } from "../../../../config/env";
import { getApiErrorMessage } from "../../../../lib/http/getApiErrorMessage";
import { queryKeys } from "../../../../lib/queryKeys";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { useAuth } from "../../../auth/context/AuthContext";
import {
  fetchReferralProgram,
  postReferralInvites,
} from "../../../referral/api/referralApi";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  onPressInvite?: () => void;
};

export function ReferFriendsBanner({ onPressInvite }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [localErr, setLocalErr] = useState("");

  const programQuery = useQuery({
    queryKey: queryKeys.referral.program,
    queryFn: fetchReferralProgram,
    staleTime: 120_000,
  });
  const program = programQuery.data;

  const referralLink = useMemo(() => {
    if (program?.webLink) return program.webLink;
    const refCode = String((user as any)?.referral_code ?? "");
    const userId = String((user as any)?._id ?? "");
    if (refCode) return `${WEB_APP_ORIGIN}/signup?code=${encodeURIComponent(refCode)}`;
    if (userId) return `${WEB_APP_ORIGIN}/signup?ref=${encodeURIComponent(userId)}`;
    return WEB_APP_ORIGIN;
  }, [program, user]);

  const rewardHint = useMemo(() => {
    const pts = program?.rewardMatrixPoints?.inviteTrainee?.referrerSignupPoints;
    if (pts && pts > 0) {
      return t("invite.bannerRewardPoints", {
        defaultValue: "Earn {{points}} points when a friend joins and books.",
        points: pts,
      });
    }
    return t("invite.bannerSub", {
      defaultValue: "Invite friends by email or share your personal link.",
    });
  }, [program, t]);

  const handleShare = useCallback(async () => {
    const name = String((user as any)?.fullname ?? (user as any)?.name ?? "");
    const message = t("invite.shareMessage", {
      defaultValue: name
        ? `${name} invited you to join NetQwix! Sign up here: ${referralLink}`
        : `Join me on NetQwix! Sign up here: ${referralLink}`,
      name,
      link: referralLink,
    });
    try {
      await Share.share({ message, url: referralLink });
    } catch {
      /* ignore */
    }
  }, [referralLink, t, user]);

  const handleSendEmail = useCallback(async () => {
    const raw = email.trim().toLowerCase();
    setLocalErr("");
    if (!raw) {
      setLocalErr(t("invites.needOneEmail", { defaultValue: "Enter an email address." }));
      return;
    }
    if (!emailRegex.test(raw)) {
      setLocalErr(t("invites.invalidEmail", { defaultValue: "Enter a valid email.", email: raw }));
      return;
    }
    setSending(true);
    try {
      const { results } = await postReferralInvites([raw], AccountType.TRAINEE);
      const row = results[0];
      if (!row?.ok) {
        setLocalErr(row?.error ?? t("invites.failedFor", { emails: raw }));
        return;
      }
      setEmail("");
      Alert.alert(
        t("invites.sentTitle", { defaultValue: "Invite sent" }),
        t("invites.sentBody", { defaultValue: "{{count}} invite(s) sent.", count: 1 })
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.referral.invites });
      void queryClient.invalidateQueries({ queryKey: queryKeys.referral.program });
    } catch (e) {
      setLocalErr(getApiErrorMessage(e, t("invites.sendFailed", { defaultValue: "Could not send invite." })));
    } finally {
      setSending(false);
    }
  }, [email, queryClient, t]);

  return (
    <View style={styles.banner}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <Ionicons name="gift-outline" size={22} color={c.brandNavy} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>
            {t("invite.bannerTitle", { defaultValue: "Invite your friends!" })}
          </Text>
          <Text style={styles.sub}>{rewardHint}</Text>
          {program?.referralCode ? (
            <Text style={styles.codeLine}>
              {t("invites.yourCode", { defaultValue: "Your code" })}:{" "}
              <Text style={styles.codeValue}>{program.referralCode}</Text>
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.bullets}>
        <Text style={styles.bullet}>
          • {t("invite.bannerBullet1", { defaultValue: "Send an email invite below" })}
        </Text>
        <Text style={styles.bullet}>
          • {t("invite.bannerBullet2", { defaultValue: "Friends sign up as trainee or trainer" })}
        </Text>
        <Text style={styles.bullet}>
          • {t("invite.bannerBullet3", { defaultValue: "Track invites on the full refer page" })}
        </Text>
      </View>

      <Text style={styles.fieldLabel}>
        {t("invites.emailLabel", { defaultValue: "Friend's email" })}
      </Text>
      <View style={styles.emailRow}>
        <TextInput
          style={[styles.emailInput, { color: c.text, borderColor: c.border, backgroundColor: c.surfaceElevated }]}
          placeholder={t("invites.emailPlaceholder", { defaultValue: "name@example.com" })}
          placeholderTextColor={c.textMuted}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (localErr) setLocalErr("");
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={() => void handleSendEmail()}
        />
        <Button
          size="sm"
          label={t("invite.bannerSend", { defaultValue: "Send" })}
          onPress={() => void handleSendEmail()}
          loading={sending}
          disabled={sending}
          fullWidth={false}
          style={styles.sendBtn}
        />
      </View>
      {localErr ? <Text style={styles.err}>{localErr}</Text> : null}

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.actionChip, pressed && { opacity: 0.88 }]}
          onPress={() => void handleShare()}
          accessibilityRole="button"
        >
          <Ionicons name="share-social-outline" size={16} color={c.brandNavy} />
          <Text style={styles.actionChipText}>
            {t("invites.shareMore", { defaultValue: "Share link" })}
          </Text>
        </Pressable>
        {onPressInvite ? (
          <Pressable
            style={({ pressed }) => [styles.actionChip, styles.actionChipPrimary, pressed && { opacity: 0.88 }]}
            onPress={onPressInvite}
            accessibilityRole="button"
          >
            <Text style={styles.actionChipTextPrimary}>
              {t("invite.bannerSeeAll", { defaultValue: "Refer friends page" })}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={c.brandTextOn} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      banner: {
        gap: space.sm,
        padding: space.md,
        borderRadius: radii.lg,
        backgroundColor: palette.brandSubtle,
        borderWidth: 1,
        borderColor: palette.brandAccentSubtle,
      },
      topRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space.sm,
      },
      iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.border,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      },
      textWrap: { flex: 1, minWidth: 0 },
      title: {
        ...typography.bodySm,
        fontWeight: "700",
        color: palette.brandNavy,
      },
      sub: {
        ...typography.caption,
        color: palette.textMuted,
        marginTop: 3,
        lineHeight: 17,
      },
      codeLine: {
        ...typography.caption,
        color: palette.textSecondary,
        marginTop: 4,
      },
      codeValue: {
        fontWeight: "800",
        color: palette.brandNavy,
      },
      bullets: {
        gap: 2,
        paddingLeft: 2,
      },
      bullet: {
        ...typography.caption,
        color: palette.textSecondary,
        lineHeight: 16,
      },
      fieldLabel: {
        ...typography.caption,
        fontWeight: "600",
        color: palette.text,
        marginTop: 2,
      },
      emailRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
      },
      emailInput: {
        flex: 1,
        minHeight: 42,
        borderWidth: 1,
        borderRadius: radii.md,
        paddingHorizontal: space.sm,
        fontSize: typography.bodySm.fontSize,
      },
      sendBtn: {
        minWidth: 72,
      },
      err: {
        ...typography.caption,
        color: palette.danger,
      },
      actions: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: space.xs,
        marginTop: 2,
      },
      actionChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
      },
      actionChipPrimary: {
        backgroundColor: palette.brandNavy,
        borderColor: palette.brandNavy,
      },
      actionChipText: {
        fontSize: 12,
        fontWeight: "600",
        color: palette.brandNavy,
      },
      actionChipTextPrimary: {
        fontSize: 12,
        fontWeight: "700",
        color: palette.brandTextOn,
      },
    })
  );
}
