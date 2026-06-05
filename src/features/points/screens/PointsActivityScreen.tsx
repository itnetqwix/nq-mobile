import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button, Card, MorphRefreshHeader } from "../../../components/ui";
import { useMorphRefreshBundle } from "../../../lib/refresh/useMorphRefreshBundle";
import { queryKeys } from "../../../lib/queryKeys";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { useFloatingTabBarBottomInset } from "../../../navigation/useFloatingTabBarBottomInset";
import type { WalletStackParamList } from "../../wallet/navigation/WalletNavigator";
import {
  fetchPointsBalance,
  fetchPointsCatalog,
  fetchPointsLedger,
  postRedeemPoints,
} from "../api/pointsApi";

type Props = NativeStackScreenProps<WalletStackParamList, "PointsActivity">;

export function PointsActivityScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const bottomPad = useFloatingTabBarBottomInset(space.md);
  const qc = useQueryClient();
  const [redeeming, setRedeeming] = useState(false);

  const balanceQuery = useQuery({
    queryKey: queryKeys.points.balance,
    queryFn: fetchPointsBalance,
  });
  const catalogQuery = useQuery({
    queryKey: queryKeys.points.catalog,
    queryFn: fetchPointsCatalog,
  });
  const ledgerQuery = useQuery({
    queryKey: queryKeys.points.ledger,
    queryFn: () => fetchPointsLedger(1, 30),
  });

  const balance = balanceQuery.data;
  const block = balance?.redeemBlockPoints ?? 100;

  const redeemMutation = useMutation({
    mutationFn: () => postRedeemPoints(block),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: queryKeys.points.balance });
      void qc.invalidateQueries({ queryKey: queryKeys.points.ledger });
      void qc.invalidateQueries({ queryKey: queryKeys.wallet.balance });
      Alert.alert(
        t("points.redeemSuccessTitle"),
        t("points.redeemSuccessBody", {
          points: data?.pointsSpent ?? block,
          dollars: data?.walletCreditDollars ?? 5,
        })
      );
    },
    onError: (e) => Alert.alert(t("points.errorTitle"), getApiErrorMessage(e)),
    onSettled: () => setRedeeming(false),
  });

  const onPointsRefresh = () => {
    void balanceQuery.refetch();
    void ledgerQuery.refetch();
  };
  const morph = useMorphRefreshBundle(
    onPointsRefresh,
    balanceQuery.isRefetching || ledgerQuery.isRefetching
  );

  const onRedeem = () => {
    if ((balance?.redeemableBlocks ?? 0) < 1) {
      Alert.alert(t("points.errorTitle"), t("points.needMore", { block }));
      return;
    }
    setRedeeming(true);
    redeemMutation.mutate();
  };

  return (
    <View style={styles.root}>
      <Pressable style={styles.backRow} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← {t("common.back")}</Text>
      </Pressable>
      <MorphRefreshHeader {...morph.headerProps} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        onScroll={morph.onMorphScroll}
        scrollEventThrottle={morph.scrollEventThrottle}
        refreshControl={
          <RefreshControl
            refreshing={morph.refreshing}
            onRefresh={morph.onRefreshControl}
          />
        }
      >
        <Card variant="outlined" style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t("points.balance")}</Text>
          {balanceQuery.isLoading ? (
            <ActivityIndicator color={c.brandAccent} />
          ) : (
            <Text style={styles.balanceValue}>{balance?.balance ?? 0} pts</Text>
          )}
          <Text style={styles.hint}>
            {t("points.redeemHint", {
              block,
              dollars: balance?.walletCreditPerBlock ?? 5,
            })}
          </Text>
          <Button
            label={t("points.redeemCta", { block })}
            onPress={onRedeem}
            loading={redeeming || redeemMutation.isPending}
            disabled={(balance?.redeemableBlocks ?? 0) < 1}
            style={{ marginTop: space.md }}
          />
        </Card>

        <Text style={styles.sectionTitle}>{t("points.howToEarn")}</Text>
        {(catalogQuery.data?.earnRules ?? []).map((rule) => (
          <View key={rule.actionKey} style={styles.ruleRow}>
            <Text style={styles.rulePts}>+{rule.points}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.ruleLabel}>{rule.label}</Text>
              <Text style={styles.ruleDesc}>{rule.description}</Text>
            </View>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: space.lg }]}>
          {t("points.history")}
        </Text>
        {(ledgerQuery.data?.entries ?? []).map((row) => (
          <View key={row._id} style={styles.ledgerRow}>
            <Text style={styles.ledgerKey}>{row.action_key.replace(/_/g, " ")}</Text>
            <Text
              style={[
                styles.ledgerPts,
                { color: row.points >= 0 ? c.success : c.danger },
              ]}
            >
              {row.points >= 0 ? "+" : ""}
              {row.points}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: palette.surface },
      backRow: { padding: space.md },
      backText: { color: palette.brandAccent, fontWeight: "600" },
      scroll: { paddingHorizontal: space.md },
      balanceCard: { marginBottom: space.md },
      balanceLabel: { ...typography.caption, color: palette.textMuted },
      balanceValue: { fontSize: 32, fontWeight: "700", color: palette.text, marginTop: 4 },
      hint: { ...typography.bodySm, color: palette.textMuted, marginTop: space.sm },
      sectionTitle: { ...typography.subtitle, fontWeight: "700", color: palette.text, marginBottom: space.sm },
      ruleRow: {
        flexDirection: "row",
        gap: space.md,
        paddingVertical: space.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
      },
      rulePts: { fontWeight: "700", color: palette.brandAccent, width: 36 },
      ruleLabel: { ...typography.bodyMd, fontWeight: "600", color: palette.text },
      ruleDesc: { ...typography.caption, color: palette.textMuted },
      ledgerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 8,
      },
      ledgerKey: { ...typography.bodySm, color: palette.text, flex: 1 },
      ledgerPts: { fontWeight: "600" },
    })
  );
}
