import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NetQwixLoader } from "../../../components/brand/NetQwixLoader";
import { Button, Card } from "../../../components/ui";
import { AccountType } from "../../../constants/accountType";
import { useAuth } from "../../auth/context/AuthContext";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { useWalletTopUpFlow } from "../hooks/useWalletTopUpFlow";
import { useWalletBalance } from "../hooks/useWalletBalance";
import type { WalletStackParamList } from "../navigation/WalletNavigator";
import { useShellHeaderTitle } from "../../../navigation/useShellHeaderTitle";
import { queryKeys } from "../../../lib/queryKeys";
import { fetchWalletConfig } from "../walletApi";
import { STRIPE_APPLE_MERCHANT_IDENTIFIER } from "../../../config/env";

const PRESETS = [25, 50, 100, 200];

type Props = NativeStackScreenProps<WalletStackParamList, "WalletTopUp">;

export function WalletTopUpScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  useShellHeaderTitle(t("wallet.addFunds"));
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { accountType } = useAuth();
  const isTrainee = accountType === AccountType.TRAINEE;

  const suggested = route.params?.suggestedAmount;
  const [amount, setAmount] = useState(
    suggested != null && suggested > 0 ? String(Math.ceil(suggested)) : "25"
  );
  const [amountError, setAmountError] = useState<string | undefined>();

  const { data: balance, refetch: refetchBalance } = useWalletBalance(isTrainee);
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: queryKeys.wallet.config,
    queryFn: fetchWalletConfig,
    staleTime: 300_000,
  });

  const { phase, runTopUp } = useWalletTopUpFlow();
  const busy = phase === "presenting" || phase === "confirming";

  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: palette.surface },
      scroll: { padding: space.lg, paddingBottom: space.xl * 2 },
      hero: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        marginBottom: space.lg,
      },
      heroIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: palette.brandSubtle,
        alignItems: "center",
        justifyContent: "center",
      },
      heroTitle: { ...typography.subtitle, color: palette.text, fontWeight: "700" },
      heroSub: { ...typography.bodySm, color: palette.textMuted, marginTop: 4, lineHeight: 18 },
      label: { ...typography.label, color: palette.text, fontWeight: "600", marginBottom: space.sm },
      presets: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.md },
      presetChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
      },
      presetActive: { backgroundColor: palette.brandNavy, borderColor: palette.brandNavy },
      presetText: { fontWeight: "600", color: palette.text },
      presetTextActive: { color: palette.brandTextOn },
      input: {
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: radii.md,
        padding: space.md,
        fontSize: 22,
        fontWeight: "600",
        color: palette.text,
        backgroundColor: palette.surfaceElevated,
      },
      inputError: { borderColor: palette.danger },
      hint: { ...typography.caption, color: palette.textMuted, marginTop: space.sm },
      error: { ...typography.caption, color: palette.danger, marginTop: space.xs },
      methods: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        marginTop: space.lg,
        padding: space.md,
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.border,
      },
      methodsText: { ...typography.caption, color: palette.textMuted, flex: 1 },
      overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: `${palette.background}E8`,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
      },
    })
  );

  const minDollars = (config?.minTopUpMinor ?? 500) / 100;
  const maxDollars = (config?.maxTopUpMinor ?? 50000) / 100;
  const topUpEnabled = config?.enabled !== false;

  const validateAmount = useCallback(
    (dollars: number): string | undefined => {
      if (!Number.isFinite(dollars)) return t("wallet.validAmount");
      if (dollars < minDollars) {
        return t("wallet.minAmount", { amount: minDollars.toFixed(2) });
      }
      if (dollars > maxDollars) {
        return t("wallet.maxAmount", { amount: maxDollars.toFixed(2) });
      }
      return undefined;
    },
    [t, minDollars, maxDollars]
  );

  const handleSubmit = async () => {
    const dollars = parseFloat(amount);
    const err = validateAmount(dollars);
    if (err) {
      setAmountError(err);
      return;
    }
    setAmountError(undefined);

    const result = await runTopUp(dollars);
    if (result.ok) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.wallet.all });
      await refetchBalance();
      Alert.alert(
        t("wallet.fundsAdded"),
        t("wallet.fundsAddedBody", { amount: result.amountDollars.toFixed(2) }),
        [{ text: t("common.done"), onPress: () => navigation.goBack() }]
      );
      return;
    }

    if (result.code === "canceled") return;

    if (result.code === "timeout") {
      await queryClient.invalidateQueries({ queryKey: queryKeys.wallet.all });
      Alert.alert(t("wallet.processingPayment"), result.message, [
        { text: t("systemActions.ok"), onPress: () => navigation.goBack() },
      ]);
      return;
    }

    Alert.alert(t("wallet.topUpFailed"), result.message);
  };

  const shortfallHint = useMemo(() => {
    if (suggested == null || suggested <= 0) return null;
    return t("wallet.shortfallHint", { amount: Math.ceil(suggested) });
  }, [suggested, t]);

  if (!isTrainee) {
    return (
      <View style={[styles.root, { padding: space.lg, justifyContent: "center" }]}>
        <Card variant="outlined" padding="lg">
          <Text style={styles.heroTitle}>{t("wallet.trainerWallet")}</Text>
          <Text style={styles.heroSub}>{t("wallet.trainerWalletSub")}</Text>
          <Button label={t("wallet.goBack")} onPress={() => navigation.goBack()} fullWidth style={{ marginTop: space.lg }} />
        </Card>
      </View>
    );
  }

  if (!topUpEnabled && !configLoading) {
    return (
      <View style={[styles.root, { padding: space.lg, justifyContent: "center" }]}>
        <Card variant="outlined" padding="lg">
          <Text style={styles.heroTitle}>{t("wallet.topUpUnavailable")}</Text>
          <Text style={styles.heroSub}>{t("wallet.topUpUnavailableSub")}</Text>
          <Button label={t("wallet.goBack")} onPress={() => navigation.goBack()} fullWidth style={{ marginTop: space.lg }} />
        </Card>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top + 56}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="card-outline" size={24} color={c.iconPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{t("wallet.addFundsSecurely")}</Text>
            <Text style={styles.heroSub}>{t("wallet.addFundsSecurelySub")}</Text>
          </View>
        </View>

        {!!shortfallHint && (
          <Card variant="outlined" padding="md" style={{ marginBottom: space.md }}>
            <Text style={{ ...typography.bodySm, color: c.brandNavy, fontWeight: "600" }}>
              {shortfallHint}
            </Text>
          </Card>
        )}

        <Text style={styles.label}>{t("wallet.amountUsd")}</Text>
        <View style={styles.presets}>
          {PRESETS.filter((p) => p >= minDollars && p <= maxDollars).map((p) => (
            <Pressable
              key={p}
              style={[styles.presetChip, amount === String(p) && styles.presetActive]}
              onPress={() => {
                setAmount(String(p));
                setAmountError(undefined);
              }}
            >
              <Text style={[styles.presetText, amount === String(p) && styles.presetTextActive]}>
                ${p}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={[styles.input, amountError && styles.inputError]}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={(t) => {
            setAmount(t.replace(/[^0-9.]/g, ""));
            setAmountError(undefined);
          }}
          placeholder={`${minDollars.toFixed(0)} – ${maxDollars.toFixed(0)}`}
          placeholderTextColor={c.textMuted}
          editable={!busy}
        />
        {amountError ? (
          <Text style={styles.error}>{amountError}</Text>
        ) : (
          <Text style={styles.hint}>
            {t("wallet.minMaxHint", {
              min: minDollars.toFixed(2),
              max: maxDollars.toFixed(2),
            })}
            {balance != null
              ? t("wallet.currentBalanceHint", {
                  balance: (balance.balances?.available ?? 0).toFixed(2),
                })
              : ""}
          </Text>
        )}

        <View style={styles.methods}>
          <Ionicons name="lock-closed-outline" size={18} color={c.textMuted} />
          <Text style={styles.methodsText}>
            {t("wallet.securedByStripe", {
              applePay:
                Platform.OS === "ios" && STRIPE_APPLE_MERCHANT_IDENTIFIER
                  ? t("wallet.applePaySuffix")
                  : "",
              googlePay: Platform.OS === "android" ? t("wallet.googlePaySuffix") : "",
            })}
          </Text>
        </View>

        <Button
          label={
            phase === "presenting"
              ? t("wallet.openingPayment")
              : phase === "confirming"
                ? t("wallet.confirming")
                : t("wallet.continueToPayment")
          }
          onPress={handleSubmit}
          fullWidth
          disabled={busy}
          loading={busy}
          style={{ marginTop: space.lg }}
          size="lg"
        />
      </ScrollView>

      {busy && (
        <View style={styles.overlay} pointerEvents="auto">
          <NetQwixLoader
            message={
              phase === "confirming" ? t("wallet.updatingBalance") : t("wallet.openingCheckout")
            }
            variant="inline"
            size="lg"
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
