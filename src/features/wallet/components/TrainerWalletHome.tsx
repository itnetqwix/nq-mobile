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
  });
  const styles = useThemedStyles((colors) =>
    StyleSheet.create({
      scroll: { padding: space.md },
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
      menuRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        padding: space.md,
        marginTop: space.md,
        backgroundColor: colors.surfaceElevated,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
      },
      menuLabel: { ...typography.bodyMd, fontWeight: "600", color: colors.text },
      menuSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
    })
  );
  const { isRefetching, refetch } = useWalletBalance();
  const morph = useMorphRefreshBundle(refetch, isRefetching);
  const showConnectBanner = connectQuery.data && connectQuery.data.complete === false;

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
      <TrainerEarningsPanel />

      <Pressable
        style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.85 }]}
        onPress={() => navigation.navigate("PointsActivity")}
      >
        <Ionicons name="star" size={22} color={c.iconPrimary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.menuLabel}>{t("points.walletTitle")}</Text>
          <Text style={styles.menuSub}>
            {t("points.walletBalance", {
              balance: pointsQuery.data?.balance ?? 0,
              block: pointsQuery.data?.redeemBlockPoints ?? 100,
              dollars: pointsQuery.data?.walletCreditPerBlock ?? 5,
            })}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.85 }]}
        onPress={() => navigation.navigate("StripeConnect")}
      >
        <Ionicons name="business-outline" size={22} color={c.iconPrimary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.menuLabel}>
            {t("wallet.stripeConnectTitle", { defaultValue: "Payout setup" })}
          </Text>
          <Text style={styles.menuSub}>
            {t("wallet.stripeConnectMenuSub", { defaultValue: "Stripe Connect bank onboarding" })}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.85 }]}
        onPress={() => navigation.navigate("WalletActivity")}
      >
        <Ionicons name="time-outline" size={22} color={c.iconPrimary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.menuLabel}>Earnings activity</Text>
          <Text style={styles.menuSub}>Payouts and session payments</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
      </Pressable>
    </ScrollView>
    </>
  );
}
