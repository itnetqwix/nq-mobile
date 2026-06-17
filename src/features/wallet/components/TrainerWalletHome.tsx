import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MorphRefreshHeader } from "../../../components/ui";
import { useMorphRefreshBundle } from "../../../lib/refresh/useMorphRefreshBundle";
import { queryKeys } from "../../../lib/queryKeys";
import { useFloatingTabBarBottomInset } from "../../../navigation/useFloatingTabBarBottomInset";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { fetchPointsBalance } from "../../points/api/pointsApi";
import { useWalletBalance } from "../hooks/useWalletBalance";
import type { WalletStackParamList } from "../navigation/WalletNavigator";
import { TrainerEarningsPanel } from "./TrainerEarningsPanel";
import { fetchStripeConnectStatus } from "../stripeConnectApi";

type Props = {
  navigation: NativeStackNavigationProp<WalletStackParamList, "WalletHome">;
};

function MenuRow({
  icon,
  label,
  sub,
  onPress,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  const c = useThemeColors();
  const styles = useThemedStyles((colors) =>
    StyleSheet.create({
      row: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        padding: space.md,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      },
      menuLabel: { ...typography.bodyMd, fontWeight: "600", color: colors.text },
      menuSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
    })
  );

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={22} color={c.iconPrimary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.menuLabel}>{label}</Text>
        <Text style={styles.menuSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
    </Pressable>
  );
}

export function TrainerWalletHome({ navigation }: Props) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const bottomPad = useFloatingTabBarBottomInset(space.md);
  const pointsQuery = useQuery({
    queryKey: queryKeys.points.balance,
    queryFn: fetchPointsBalance,
  });
  const connectQuery = useQuery({
    queryKey: queryKeys.wallet.stripeConnect,
    queryFn: fetchStripeConnectStatus,
    retry: 1,
  });
  const styles = useThemedStyles((colors) =>
    StyleSheet.create({
      scroll: { padding: space.md },
      sectionTitle: {
        ...typography.subtitle,
        color: colors.text,
        fontWeight: "700",
        marginTop: space.md,
        marginBottom: space.sm,
      },
      connectBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        padding: space.md,
        marginBottom: space.sm,
        backgroundColor: colors.warningSubtle,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.warning,
      },
      connectBannerText: { ...typography.bodySm, color: colors.text, flex: 1 },
      menuSection: {
        backgroundColor: colors.surfaceElevated,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
      },
    })
  );
  const { isRefetching, refetch } = useWalletBalance();
  const morph = useMorphRefreshBundle(refetch, isRefetching);
  const showConnectBanner =
    connectQuery.data?.complete === false || connectQuery.isError;

  return (
    <>
      <MorphRefreshHeader {...morph.headerProps} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        onScroll={morph.onMorphScroll}
        scrollEventThrottle={morph.scrollEventThrottle}
        refreshControl={
          <RefreshControl
            refreshing={morph.refreshing}
            onRefresh={morph.onRefreshControl}
            tintColor={c.iconPrimary}
          />
        }
      >
        {showConnectBanner ? (
          <Pressable
            style={({ pressed }) => [styles.connectBanner, pressed && { opacity: 0.85 }]}
            onPress={() => navigation.navigate("StripeConnect")}
          >
            <Ionicons name="alert-circle-outline" size={22} color={c.warning} />
            <Text style={styles.connectBannerText}>
              {t("wallet.stripeConnectIncomplete", {
                defaultValue: "Complete payout setup to receive earnings.",
              })}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </Pressable>
        ) : null}

        <Text style={[styles.sectionTitle, { marginTop: 0 }]}>
          {t("wallet.earningsSection", { defaultValue: "Earnings" })}
        </Text>
        <TrainerEarningsPanel />

        <Text style={styles.sectionTitle}>
          {t("wallet.manageSection", { defaultValue: "Manage" })}
        </Text>
        <View style={styles.menuSection}>
          <MenuRow
            icon="receipt-outline"
            label={t("nav.transactions", { defaultValue: "Transactions" })}
            sub={t("transactions.pageSub", {
              defaultValue: "Session payments, payouts, and refunds",
            })}
            onPress={() => navigation.navigate("WalletTransactions")}
          />
          <MenuRow
            icon="time-outline"
            label={t("wallet.activity", { defaultValue: "Earnings activity" })}
            sub={t("wallet.trainerActivitySub", {
              defaultValue: "Payouts and session payments",
            })}
            onPress={() => navigation.navigate("WalletActivity")}
          />
          <MenuRow
            icon="star"
            label={t("points.walletTitle")}
            sub={t("points.walletBalance", {
              balance: pointsQuery.data?.balance ?? 0,
              block: pointsQuery.data?.redeemBlockPoints ?? 100,
              dollars: pointsQuery.data?.walletCreditPerBlock ?? 5,
            })}
            onPress={() => navigation.navigate("PointsActivity")}
          />
          <MenuRow
            icon="business-outline"
            label={t("wallet.stripeConnectTitle", { defaultValue: "Payout setup" })}
            sub={t("wallet.stripeConnectMenuSub", {
              defaultValue: "Stripe Connect bank onboarding",
            })}
            onPress={() => navigation.navigate("StripeConnect")}
            isLast
          />
        </View>
      </ScrollView>
    </>
  );
}
