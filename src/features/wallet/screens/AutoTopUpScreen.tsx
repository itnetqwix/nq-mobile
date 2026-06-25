/**
 * Auto Top-Up rule screen.
 *
 * Trainees can configure a "if balance < ₹500, add ₹2,000" rule so they
 * never miss an instant lesson because the wallet ran dry mid-session.
 * The screen renders:
 *   - a master enabled/disabled toggle,
 *   - threshold (when to fire) + reload amount (how much to add),
 *   - default payment-method preview (taps through to {@link SavedPaymentMethodsScreen}),
 *   - last-fire status when available.
 *
 * Everything mutates through `saveAutoTopUpRule` so the backend stays the
 * single source of truth; we invalidate `queryKeys.wallet.autoTopUp` on
 * success to keep the UI in sync.
 */

import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button, Card, KeyboardAwareScrollScreen } from "../../../components/ui";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { queryKeys } from "../../../lib/queryKeys";
import { useCurrencyFormatter } from "../../../lib/intl";
import {
  disableAutoTopUpRule,
  fetchAutoTopUpRule,
  fetchSavedPaymentMethods,
  fetchWalletBalance,
  saveAutoTopUpRule,
  type AutoTopUpRule,
  type SavedPaymentMethod,
} from "../walletApi";

const PRESET_THRESHOLDS = [5, 10, 20, 50];
const PRESET_RELOADS = [25, 50, 100, 200];

function findDefaultMethod(methods: SavedPaymentMethod[]): SavedPaymentMethod | undefined {
  return methods.find((m) => m.isDefault) ?? methods[0];
}

export function AutoTopUpScreen() {
  const c = useThemeColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const fmt = useCurrencyFormatter();
  const queryClient = useQueryClient();

  const { data: rule, isLoading: ruleLoading } = useQuery({
    queryKey: queryKeys.wallet.autoTopUp,
    queryFn: fetchAutoTopUpRule,
    staleTime: 60_000,
  });

  const { data: methods = [] } = useQuery({
    queryKey: queryKeys.wallet.paymentMethods,
    queryFn: fetchSavedPaymentMethods,
    staleTime: 60_000,
  });

  const { data: balance } = useQuery({
    queryKey: queryKeys.wallet.balance,
    queryFn: fetchWalletBalance,
  });

  const defaultMethod = useMemo(() => findDefaultMethod(methods), [methods]);
  /**
   * Always render through the live wallet currency (server-authoritative)
   * with a fallback to the persisted rule currency. This means the rule
   * formatter follows the *currently active* wallet — important if a user
   * changes regions later.
   */
  const currency = balance?.currency ?? rule?.currency ?? "USD";

  const [enabled, setEnabled] = useState<boolean>(false);
  const [threshold, setThreshold] = useState<string>("10");
  const [reload, setReload] = useState<string>("50");

  // Hydrate form state once the saved rule arrives. The conditional avoids
  // overwriting in-progress edits if the screen refetches behind the user.
  useEffect(() => {
    if (rule) {
      setEnabled(!!rule.enabled);
      setThreshold(String(Math.round((rule.thresholdMinor ?? 1000) / 100)));
      setReload(String(Math.round((rule.reloadMinor ?? 5000) / 100)));
    }
  }, [rule]);

  const saveMut = useMutation({
    mutationFn: (next: Partial<AutoTopUpRule>) => saveAutoTopUpRule(next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.autoTopUp });
      Alert.alert(
        t("wallet.autoTopUp.savedTitle", { defaultValue: "Auto top-up updated" }),
        t("wallet.autoTopUp.savedBody", {
          defaultValue: "Your wallet will reload automatically when it drops below the threshold.",
        })
      );
    },
    onError: (err: any) => {
      Alert.alert(
        t("common.error"),
        err?.response?.data?.error ?? err?.message ?? t("common.somethingWentWrong", { defaultValue: "Something went wrong" })
      );
    },
  });

  const disableMut = useMutation({
    mutationFn: disableAutoTopUpRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.autoTopUp });
      setEnabled(false);
    },
  });

  const handleSave = () => {
    const thresholdNumber = parseFloat(threshold);
    const reloadNumber = parseFloat(reload);
    if (!Number.isFinite(thresholdNumber) || thresholdNumber <= 0) {
      Alert.alert(
        t("wallet.autoTopUp.invalidThreshold", { defaultValue: "Invalid threshold" }),
        t("wallet.autoTopUp.invalidThresholdBody", {
          defaultValue: "Enter a threshold amount greater than zero.",
        })
      );
      return;
    }
    if (!Number.isFinite(reloadNumber) || reloadNumber <= 0) {
      Alert.alert(
        t("wallet.autoTopUp.invalidReload", { defaultValue: "Invalid reload" }),
        t("wallet.autoTopUp.invalidReloadBody", {
          defaultValue: "Enter a reload amount greater than zero.",
        })
      );
      return;
    }
    if (reloadNumber <= thresholdNumber) {
      Alert.alert(
        t("wallet.autoTopUp.reloadBelowThresholdTitle", {
          defaultValue: "Reload should be larger",
        }),
        t("wallet.autoTopUp.reloadBelowThresholdBody", {
          defaultValue:
            "Set the reload higher than the threshold — otherwise the wallet would re-trigger immediately.",
        })
      );
      return;
    }
    saveMut.mutate({
      enabled,
      thresholdMinor: Math.round(thresholdNumber * 100),
      reloadMinor: Math.round(reloadNumber * 100),
      paymentMethodId: defaultMethod?.id ?? null,
      currency,
    });
  };

  return (
    <KeyboardAwareScrollScreen
      style={styles.root}
      contentContainerStyle={styles.content}
      closedBottomInset={space.xl}
      footer={
        <View style={styles.actions}>
          <Button
            label={
              ruleLoading
                ? t("common.loading")
                : t("wallet.autoTopUp.save", { defaultValue: "Save changes" })
            }
            onPress={handleSave}
            disabled={saveMut.isPending || !defaultMethod}
            loading={saveMut.isPending}
            fullWidth
            size="lg"
          />
          {rule?.enabled ? (
            <Button
              label={t("wallet.autoTopUp.disable", { defaultValue: "Turn off auto top-up" })}
              variant="secondary"
              onPress={() => disableMut.mutate()}
              disabled={disableMut.isPending}
              fullWidth
            />
          ) : null}
        </View>
      }
    >
        <Text style={styles.title}>{t("wallet.autoTopUp.title", { defaultValue: "Auto top-up" })}</Text>
        <Text style={styles.sub}>
          {t("wallet.autoTopUp.intro", {
            defaultValue:
              "Avoid running out mid-lesson. We'll top up your wallet automatically when it dips below your threshold.",
          })}
        </Text>

        <Card variant="outlined" padding="md" style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>
                {t("wallet.autoTopUp.enableLabel", { defaultValue: "Enable auto top-up" })}
              </Text>
              <Text style={styles.rowSub}>
                {enabled
                  ? t("wallet.autoTopUp.enabledHint", {
                      threshold: fmt(parseFloat(threshold) || 0, { currency }),
                      reload: fmt(parseFloat(reload) || 0, { currency }),
                      defaultValue: "If below {{threshold}}, add {{reload}}",
                    })
                  : t("wallet.autoTopUp.disabledHint", {
                      defaultValue: "Currently disabled",
                    })}
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              accessibilityLabel={t("wallet.autoTopUp.enableLabel", { defaultValue: "Enable auto top-up" })}
            />
          </View>
        </Card>

        <Text style={styles.section}>
          {t("wallet.autoTopUp.threshold", { defaultValue: "When balance falls below" })}
        </Text>
        <Presets
          presets={PRESET_THRESHOLDS}
          value={threshold}
          onChange={setThreshold}
          currency={currency}
        />
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={threshold}
          onChangeText={(v) => setThreshold(v.replace(/[^0-9.]/g, ""))}
          placeholder={t("wallet.autoTopUp.thresholdPlaceholder", { defaultValue: "Threshold amount" })}
          placeholderTextColor={c.textMuted}
        />

        <Text style={styles.section}>
          {t("wallet.autoTopUp.reloadAmount", { defaultValue: "Add this amount" })}
        </Text>
        <Presets
          presets={PRESET_RELOADS}
          value={reload}
          onChange={setReload}
          currency={currency}
        />
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={reload}
          onChangeText={(v) => setReload(v.replace(/[^0-9.]/g, ""))}
          placeholder={t("wallet.autoTopUp.reloadPlaceholder", { defaultValue: "Reload amount" })}
          placeholderTextColor={c.textMuted}
        />

        <Text style={styles.section}>
          {t("wallet.autoTopUp.payWith", { defaultValue: "Charge to" })}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.methodRow, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <Ionicons
            name={defaultMethod ? "card-outline" : "alert-circle-outline"}
            size={20}
            color={c.iconPrimary}
          />
          <View style={{ flex: 1 }}>
            {defaultMethod ? (
              <>
                <Text style={styles.methodLabel}>
                  {defaultMethod.brand.toUpperCase()} •••• {defaultMethod.last4}
                </Text>
                <Text style={styles.methodSub}>
                  {t("wallet.autoTopUp.methodHint", {
                    defaultValue: "Manage cards from the wallet settings",
                  })}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.methodLabel}>
                  {t("wallet.autoTopUp.noMethod", { defaultValue: "No saved card" })}
                </Text>
                <Text style={styles.methodSub}>
                  {t("wallet.autoTopUp.noMethodHint", {
                    defaultValue: "Add one from the wallet settings to enable auto top-up.",
                  })}
                </Text>
              </>
            )}
          </View>
        </Pressable>

        {rule?.lastTriggeredAt ? (
          <Card variant="outlined" padding="md" style={styles.card}>
            <Text style={styles.rowLabel}>
              {t("wallet.autoTopUp.lastFired", { defaultValue: "Last reload" })}
            </Text>
            <Text style={styles.rowSub}>
              {new Date(rule.lastTriggeredAt).toLocaleString()} ·{" "}
              {rule.lastStatus
                ? t(`wallet.autoTopUp.status.${rule.lastStatus}`, {
                    defaultValue: rule.lastStatus,
                  })
                : "—"}
            </Text>
          </Card>
        ) : null}
    </KeyboardAwareScrollScreen>
  );
}

function Presets({
  presets,
  value,
  onChange,
  currency,
}: {
  presets: number[];
  value: string;
  onChange: (v: string) => void;
  currency: string;
}) {
  const styles = useStyles();
  const fmt = useCurrencyFormatter();
  return (
    <View style={styles.presets}>
      {presets.map((p) => {
        const active = value === String(p);
        return (
          <Pressable
            key={p}
            onPress={() => onChange(String(p))}
            style={[styles.presetChip, active && styles.presetActive]}
            accessibilityRole="button"
          >
            <Text style={[styles.presetText, active && styles.presetTextActive]}>
              {fmt(p, { currency, maximumFractionDigits: 0 })}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function useStyles() {
  return useThemedStyles((c) =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: c.background },
      content: { padding: space.lg, paddingBottom: space.xl * 2, gap: space.sm },
      title: { ...typography.titleLg, color: c.text },
      sub: { ...typography.bodySm, color: c.textMuted, marginBottom: space.md },
      card: { marginVertical: space.sm },
      switchRow: { flexDirection: "row", alignItems: "center", gap: space.md },
      rowLabel: { ...typography.bodyMd, fontWeight: "700", color: c.text },
      rowSub: { ...typography.bodySm, color: c.textMuted, marginTop: 2 },
      section: { ...typography.label, color: c.text, marginTop: space.md, marginBottom: space.xs },
      presets: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.sm },
      presetChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surfaceElevated,
      },
      presetActive: { backgroundColor: c.brandNavy, borderColor: c.brandNavy },
      presetText: { ...typography.bodySm, color: c.text, fontWeight: "600" },
      presetTextActive: { color: c.brandTextOn },
      input: {
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: radii.md,
        padding: space.md,
        backgroundColor: c.surfaceElevated,
        ...typography.bodyMd,
        color: c.text,
      },
      methodRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        padding: space.md,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surfaceElevated,
      },
      methodLabel: { ...typography.bodyMd, fontWeight: "600", color: c.text },
      methodSub: { ...typography.bodySm, color: c.textMuted, marginTop: 2 },
      actions: { marginTop: space.lg, gap: space.sm },
    })
  );
}
