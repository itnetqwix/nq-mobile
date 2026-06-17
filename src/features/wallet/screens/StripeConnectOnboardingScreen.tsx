import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, ScreenContainer } from "../../../components/ui";
import { FadeInView } from "../../../lib/motion/FadeInView";
import { useAuth } from "../../auth/context/AuthContext";
import { queryKeys } from "../../../lib/queryKeys";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import type { WalletStackParamList } from "../navigation/WalletNavigator";
import {
  createStripeConnectOnboardingUrl,
  fetchStripeConnectStatus,
  registerStripeAccount,
} from "../stripeConnectApi";
import { useShellHeaderTitle } from "../../../navigation/useShellHeaderTitle";

type Props = NativeStackScreenProps<WalletStackParamList, "StripeConnect">;

type StepState = "done" | "current" | "upcoming";

function PayoutStep({
  index,
  title,
  body,
  state,
}: {
  index: number;
  title: string;
  body: string;
  state: StepState;
}) {
  const c = useThemeColors();
  const icon =
    state === "done" ? "checkmark-circle" : state === "current" ? "ellipse" : "ellipse-outline";
  const iconColor =
    state === "done" ? c.success : state === "current" ? c.brandAccent : c.textMuted;

  return (
    <FadeInView index={index}>
      <View style={stepStyles.row}>
        <Ionicons name={icon} size={22} color={iconColor} />
        <View style={stepStyles.copy}>
          <Text style={[stepStyles.title, { color: c.text }]}>{title}</Text>
          <Text style={[stepStyles.body, { color: c.textMuted }]}>{body}</Text>
        </View>
      </View>
    </FadeInView>
  );
}

const stepStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  copy: { flex: 1, gap: 2 },
  title: { ...typography.subtitle, fontWeight: "700" },
  body: { ...typography.bodySm, lineHeight: 18 },
});

export function StripeConnectOnboardingScreen(_props: Props) {
  const { t } = useTranslation();
  useShellHeaderTitle(t("wallet.stripeConnectTitle", { defaultValue: "Payout setup" }));
  const c = useThemeColors();
  const { user, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);

  const stripeAccountId = String(
    (user as Record<string, unknown>)?.stripe_account_id ?? ""
  );
  const kycComplete = Boolean((user as Record<string, unknown>)?.is_kyc_completed);

  const statusQuery = useQuery({
    queryKey: queryKeys.wallet.stripeConnect,
    queryFn: fetchStripeConnectStatus,
    enabled: Boolean(stripeAccountId),
  });

  const complete = stripeAccountId
    ? statusQuery.data?.complete ?? kycComplete
    : false;
  const statusLoading = Boolean(stripeAccountId) && statusQuery.isLoading;

  const steps = useMemo(() => {
    const accountStep: StepState = stripeAccountId ? "done" : "current";
    const verifyStep: StepState = !stripeAccountId
      ? "upcoming"
      : complete
        ? "done"
        : "current";
    const readyStep: StepState = complete ? "done" : "upcoming";
    return { accountStep, verifyStep, readyStep };
  }, [complete, stripeAccountId]);

  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      scroll: { padding: space.lg, gap: space.lg },
      hero: {
        alignItems: "center",
        paddingVertical: space.md,
        gap: space.sm,
      },
      heroTitle: { ...typography.titleMd, color: palette.text, textAlign: "center" },
      heroSub: { ...typography.bodyMd, color: palette.textMuted, textAlign: "center", lineHeight: 22 },
      statusBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        padding: space.md,
        borderRadius: radii.lg,
        backgroundColor: complete ? palette.successSubtle : palette.warningSubtle,
        borderWidth: 1,
        borderColor: complete ? palette.success : palette.warning,
      },
      statusText: { ...typography.bodyMd, color: palette.text, flex: 1, fontWeight: "600" },
      stepsCard: { gap: space.md },
      footnote: { ...typography.caption, color: palette.textMuted, textAlign: "center", lineHeight: 18 },
    })
  );

  const openOnboarding = useCallback(async () => {
    if (!stripeAccountId) {
      Alert.alert(
        t("wallet.stripeConnectTitle", { defaultValue: "Payout setup" }),
        t("wallet.stripeConnectMissingAccount", {
          defaultValue: "Your payout account is still being created. Tap refresh or try again shortly.",
        })
      );
      return;
    }
    setBusy(true);
    try {
      await registerStripeAccount(stripeAccountId);
      const url = await createStripeConnectOnboardingUrl(stripeAccountId);
      if (!url) throw new Error("Could not open Stripe onboarding.");
      await Linking.openURL(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Stripe onboarding failed.";
      Alert.alert(t("common.error", { defaultValue: "Error" }), msg);
    } finally {
      setBusy(false);
    }
  }, [stripeAccountId, t]);

  const refreshStatus = useCallback(async () => {
    await refreshUser();
    await statusQuery.refetch();
  }, [refreshUser, statusQuery]);

  const statusMessage = !stripeAccountId
    ? t("wallet.stripeConnectMissingAccount", {
        defaultValue: "We're setting up your payout account. This usually takes a moment.",
      })
    : statusLoading
      ? t("common.loading", { defaultValue: "Loading…" })
      : complete
        ? t("wallet.stripeConnectComplete", { defaultValue: "You're ready to receive payouts." })
        : t("wallet.stripeConnectIncomplete", {
            defaultValue: "Finish bank details in Stripe to unlock payouts.",
          });

  return (
    <ScreenContainer scroll dismissKeyboardOnTap padding="lg" background={c.background} contentStyle={styles.scroll}>
      <FadeInView>
        <View style={styles.hero}>
          <Ionicons name="wallet-outline" size={44} color={c.brandAccent} />
          <Text style={styles.heroTitle}>
            {t("wallet.stripeConnectTitle", { defaultValue: "Payout setup" })}
          </Text>
          <Text style={styles.heroSub}>
            {t("wallet.stripeConnectSub", {
              defaultValue: "One quick Stripe setup so lesson earnings land in your bank.",
            })}
          </Text>
        </View>
      </FadeInView>

      <FadeInView index={1}>
        <View style={styles.statusBanner}>
          <Ionicons
            name={complete ? "checkmark-circle" : stripeAccountId ? "time-outline" : "hourglass-outline"}
            size={22}
            color={complete ? c.success : c.warning}
          />
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      </FadeInView>

      <Card style={styles.stepsCard}>
        <PayoutStep
          index={0}
          state={steps.accountStep}
          title={t("wallet.stripeStepAccount", { defaultValue: "Create payout account" })}
          body={t("wallet.stripeStepAccountBody", {
            defaultValue: "We link your NetQwix trainer profile to Stripe.",
          })}
        />
        <PayoutStep
          index={1}
          state={steps.verifyStep}
          title={t("wallet.stripeStepVerify", { defaultValue: "Verify in Stripe" })}
          body={t("wallet.stripeStepVerifyBody", {
            defaultValue: "Add identity and bank details securely in Stripe's hosted flow.",
          })}
        />
        <PayoutStep
          index={2}
          state={steps.readyStep}
          title={t("wallet.stripeStepReady", { defaultValue: "Receive payouts" })}
          body={t("wallet.stripeStepReadyBody", {
            defaultValue: "Lesson earnings transfer to your bank after each session.",
          })}
        />
      </Card>

      <FadeInView index={2}>
        <Button
          onPress={() => void openOnboarding()}
          loading={busy || statusLoading}
          disabled={busy || statusLoading || !stripeAccountId}
          leftIcon={complete ? "create-outline" : "open-outline"}
        >
          {complete
            ? t("wallet.stripeConnectUpdate", { defaultValue: "Update payout details" })
            : t("wallet.stripeConnectStart", { defaultValue: "Continue in Stripe" })}
        </Button>
        <Pressable onPress={() => void refreshStatus()} style={{ marginTop: space.md, alignItems: "center" }}>
          <Text style={{ color: c.brandAccent, fontWeight: "600" }}>
            {t("common.refreshStatus", { defaultValue: "Refresh status" })}
          </Text>
        </Pressable>
        <Text style={[styles.footnote, { marginTop: space.md }]}>
          {t("wallet.stripeConnectFootnote", {
            defaultValue: "You'll return here after Stripe. Use refresh if your status doesn't update right away.",
          })}
        </Text>
      </FadeInView>
    </ScreenContainer>
  );
}
