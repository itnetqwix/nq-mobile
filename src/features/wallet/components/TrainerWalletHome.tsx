import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { queryKeys } from "../../../lib/queryKeys";
import { useFloatingTabBarBottomInset } from "../../../navigation/useFloatingTabBarBottomInset";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { fetchPointsBalance } from "../../points/api/pointsApi";
import { useWalletBalance } from "../hooks/useWalletBalance";
import type { WalletStackParamList } from "../navigation/WalletNavigator";
import { TrainerEarningsPanel } from "./TrainerEarningsPanel";

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
  const styles = useThemedStyles((colors) =>
    StyleSheet.create({
      scroll: { padding: space.md },
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

  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.iconPrimary} />
      }
    >
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
  );
}
