import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Button, Card, ScreenContainer, SectionHeader } from "../../../components/ui";
import { fetchStorageInfo } from "../../home/api/homeApi";
import { StackSwipeBackShell } from "../../../navigation/StackSwipeBackShell";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { useStorageCheckoutFlow, type StorageCheckoutInterval } from "../hooks/useStorageCheckoutFlow";

function formatGb(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 10 ? `${Math.round(gb)} GB` : `${gb.toFixed(1)} GB`;
}

export function StoragePlanScreen() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { busy, subscribe } = useStorageCheckoutFlow();
  const [interval, setInterval] = useState<StorageCheckoutInterval>("monthly");

  const q = useQuery({
    queryKey: ["storage", "info"],
    queryFn: fetchStorageInfo,
  });

  const info = q.data;
  const used = info?.usedBytes ?? 0;
  const quota = info?.quotaBytes ?? 2 * 1024 * 1024 * 1024;
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;

  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      barTrack: {
        height: 10,
        borderRadius: radii.pill,
        backgroundColor: palette.surfaceMuted,
        overflow: "hidden",
        marginTop: space.sm,
      },
      barFill: { height: "100%", backgroundColor: palette.brandNavy },
      segment: {
        flexDirection: "row",
        padding: 4,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceMuted,
        marginBottom: space.md,
      },
      segBtn: { flex: 1, paddingVertical: 8, borderRadius: radii.sm, alignItems: "center" },
      segOn: { backgroundColor: palette.surfaceElevated },
      planCard: {
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: radii.lg,
        padding: space.md,
        marginBottom: space.sm,
        gap: 4,
      },
      planCardCurrent: { borderColor: palette.brandNavy, backgroundColor: palette.brandSubtle },
      planRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    })
  );

  const paidPlans = useMemo(
    () => (info?.plans ?? []).filter((p) => p.id !== "free"),
    [info?.plans]
  );

  const onSelectPlan = async (planId: string) => {
    if (planId === "free" || planId === info?.planId) return;
    const result = await subscribe(planId, interval);
    if (result.ok) {
      void queryClient.invalidateQueries({ queryKey: ["storage"] });
      Alert.alert(t("storage.upgradedTitle"), t("storage.upgradedBody"));
      return;
    }
    if ("canceled" in result && result.canceled) return;
    Alert.alert(t("storage.checkoutError"), result.message ?? t("storage.checkoutError"));
  };

  return (
    <StackSwipeBackShell>
      <ScreenContainer scroll padding="md">
        <SectionHeader label={t("storage.title")} />
        {q.isLoading ? (
          <ActivityIndicator color={c.brandNavy} />
        ) : (
          <Card variant="outlined" padding="md" style={{ marginBottom: space.md }}>
            <Text style={[typography.bodySm, { color: c.textMuted }]}>{t("storage.usage")}</Text>
            <Text style={[typography.titleMd, { color: c.text, marginTop: 4 }]}>
              {formatGb(used)} / {formatGb(quota)}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct}%` }]} />
            </View>
            <Text style={[typography.caption, { color: c.textMuted, marginTop: 6 }]}>
              {t("storage.currentPlan", { plan: info?.planLabel ?? "Free" })}
            </Text>
          </Card>
        )}

        <View style={styles.segment}>
          {(["monthly", "yearly", "one_time"] as const).map((iv) => (
            <Pressable
              key={iv}
              style={[styles.segBtn, interval === iv && styles.segOn]}
              onPress={() => setInterval(iv)}
            >
              <Text
                style={[
                  typography.label,
                  { color: interval === iv ? c.brandNavy : c.textMuted, fontWeight: "700" },
                ]}
              >
                {t(`storage.interval.${iv}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        {interval === "yearly" ? (
          <Text style={[typography.caption, { color: c.success, marginBottom: space.sm }]}>
            {t("storage.yearlySavings")}
          </Text>
        ) : null}

        {paidPlans.map((plan) => {
          const price =
            interval === "yearly"
              ? plan.yearlyPrice
              : interval === "one_time"
                ? plan.monthlyPrice
                : plan.monthlyPrice;
          const isCurrent = info?.planId === plan.id;
          return (
            <View
              key={plan.id}
              style={[styles.planCard, isCurrent && styles.planCardCurrent]}
            >
              <View style={styles.planRow}>
                <View>
                  <Text style={[typography.titleSm, { color: c.text }]}>{plan.label}</Text>
                  <Text style={[typography.caption, { color: c.textMuted }]}>
                    {formatGb(plan.quotaBytes)}
                  </Text>
                </View>
                <Text style={[typography.titleSm, { color: c.brandNavy }]}>
                  ${price.toFixed(2)}
                  {interval === "monthly" ? t("storage.perMonth") : interval === "yearly" ? t("storage.perYear") : ""}
                </Text>
              </View>
              {!isCurrent && plan.id !== "free" ? (
                <Button
                  label={busy ? t("common.loading") : t("storage.subscribe")}
                  onPress={() => void onSelectPlan(plan.id)}
                  disabled={busy}
                  size="sm"
                  style={{ marginTop: space.sm }}
                />
              ) : isCurrent ? (
                <Text style={[typography.caption, { color: c.textMuted, marginTop: 4 }]}>
                  {t("storage.currentBadge")}
                </Text>
              ) : null}
            </View>
          );
        })}

        <Pressable
          onPress={() => navigation.goBack()}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.lg }}
        >
          <Ionicons name="chevron-back" size={18} color={c.brandNavy} />
          <Text style={{ color: c.brandNavy, fontWeight: "600" }}>{t("common.back")}</Text>
        </Pressable>
      </ScreenContainer>
    </StackSwipeBackShell>
  );
}
