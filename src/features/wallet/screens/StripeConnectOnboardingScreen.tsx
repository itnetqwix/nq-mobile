import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, ScreenContainer } from "../../../components/ui";
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

export function StripeConnectOnboardingScreen({ navigation }: Props) {
  const { t } = useTranslation();
  useShellHeaderTitle(t("wallet.stripeConnectTitle", { defaultValue: "Payout setup" }));
  const c = useThemeColors();
  const { user, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);

  const stripeAccountId = String(
    (user as Record<string, unknown>)?.stripe_account_id ?? ""
  );

  const statusQuery = useQuery({
    queryKey: queryKeys.wallet.stripeConnect,
    queryFn: fetchStripeConnectStatus,
    enabled: Boolean(stripeAccountId),
  });

  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      scroll: { padding: space.lg, gap: space.md },
      hero: {
        alignItems: "center",
        paddingVertical: space.lg,
        gap: space.sm,
      },
      heroTitle: { ...typography.titleMd, color: palette.text, textAlign: "center" },
      heroSub: { ...typography.bodyMd, color: palette.textMuted, textAlign: "center", lineHeight: 22 },
      statusRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        padding: space.md,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.border,
      },
      statusText: { ...typography.bodyMd, color: palette.text, flex: 1 },
    })
  );

  const openOnboarding = useCallback(async () => {
    if (!stripeAccountId) {
      Alert.alert(
        t("wallet.stripeConnectTitle", { defaultValue: "Payout setup" }),
        t("wallet.stripeConnectMissingAccount", {
          defaultValue: "Your payout account is still being created. Pull to refresh or try again shortly.",
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

  const complete = statusQuery.data?.complete;

  return (
    <ScreenContainer scroll dismissKeyboardOnTap padding="lg" background={c.background} contentStyle={styles.scroll}>
      <View style={styles.hero}>
        <Ionicons name="card-outline" size={48} color={c.brandAccent} />
        <Text style={styles.heroTitle}>
          {t("wallet.stripeConnectTitle", { defaultValue: "Stripe Connect payouts" })}
        </Text>
        <Text style={styles.heroSub}>
          {t("wallet.stripeConnectSub", {
            defaultValue:
              "Complete Stripe onboarding to receive lesson earnings. Required before your first payout.",
          })}
        </Text>
      </View>

      <View style={styles.statusRow}>
        <Ionicons
          name={complete ? "checkmark-circle" : "time-outline"}
          size={22}
          color={complete ? c.success : c.warning}
        />
        <Text style={styles.statusText}>
          {complete
            ? t("wallet.stripeConnectComplete", { defaultValue: "Payout account verified." })
            : t("wallet.stripeConnectIncomplete", {
                defaultValue: "Onboarding incomplete — add bank details in Stripe.",
              })}
        </Text>
      </View>

      <Card>
        <Button onPress={() => void openOnboarding()} loading={busy} disabled={busy}>
          {complete
            ? t("wallet.stripeConnectUpdate", { defaultValue: "Update payout details" })
            : t("wallet.stripeConnectStart", { defaultValue: "Continue in Stripe" })}
        </Button>
        <Pressable onPress={() => void refreshStatus()} style={{ marginTop: space.md, alignItems: "center" }}>
          <Text style={{ color: c.brandAccent, fontWeight: "600" }}>
            {t("common.refreshStatus", { defaultValue: "Refresh status" })}
          </Text>
        </Pressable>
      </Card>

      <Button variant="ghost" onPress={() => navigation.goBack()}>
        {t("common.back", { defaultValue: "Back" })}
      </Button>
    </ScreenContainer>
  );
}
