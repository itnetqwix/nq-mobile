import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccountType } from "../../../constants/accountType";
import { useAuth } from "../../auth/context/AuthContext";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { useWalletBalance } from "../hooks/useWalletBalance";
import { useQuery } from "@tanstack/react-query";
import { fetchPointsBalance } from "../../points/api/pointsApi";
import { queryKeys } from "../../../lib/queryKeys";
import { useFloatingTabBarBottomInset } from "../../../navigation/useFloatingTabBarBottomInset";
import type { WalletStackParamList } from "../navigation/WalletNavigator";
import { TrainerWalletHome } from "../components/TrainerWalletHome";
import { useShellHeaderTitle } from "../../../navigation/useShellHeaderTitle";
import { useCurrencyFormatter } from "../../../lib/intl";

type Props = NativeStackScreenProps<WalletStackParamList, "WalletHome">;

function useWalletHomeStyles() {
  return useThemedStyles((c) =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: c.surface },
      scroll: { padding: space.md, paddingBottom: space.xl },
      balanceCard: {
        backgroundColor: c.brandNavy,
        borderRadius: radii.lg,
        padding: space.lg,
        marginBottom: space.lg,
      },
      balanceLabel: { color: "rgba(255,255,255,0.75)", fontSize: 14 },
      balanceValue: { color: "#fff", fontSize: 36, fontWeight: "700", marginTop: 4 },
      balanceSkeleton: {
        height: 40,
        width: 140,
        backgroundColor: "rgba(255,255,255,0.2)",
        borderRadius: 8,
        marginTop: 8,
      },
      pendingText: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 8 },
      addFundsBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        alignSelf: "flex-start",
        backgroundColor: "rgba(255,255,255,0.2)",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: radii.pill,
        marginTop: space.md,
      },
      addFundsText: { color: "#fff", fontWeight: "600", fontSize: 15 },
      sectionTitle: { ...typography.subtitle, color: c.text, marginBottom: space.sm, fontWeight: "700" },
      benefitRow: {
        flexDirection: "row",
        gap: space.md,
        marginBottom: space.md,
        padding: space.md,
        backgroundColor: c.surfaceElevated,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: c.border,
      },
      benefitIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: c.brandSubtle,
        alignItems: "center",
        justifyContent: "center",
      },
      benefitTitle: { ...typography.bodyMd, fontWeight: "600", color: c.text },
      benefitText: { ...typography.bodySm, color: c.textMuted, marginTop: 2, lineHeight: 18 },
      menuSection: {
        marginTop: space.md,
        backgroundColor: c.surfaceElevated,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: c.border,
        overflow: "hidden",
      },
      menuRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        padding: space.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.border,
      },
      menuLabel: { ...typography.bodyMd, fontWeight: "600", color: c.text },
      menuSub: { ...typography.caption, color: c.textMuted, marginTop: 2 },
    })
  );
}

function TraineeWalletHome({ navigation }: Props) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const styles = useWalletHomeStyles();
  const bottomPad = useFloatingTabBarBottomInset(space.md);
  const { data: balance, isLoading, isRefetching, refetch } = useWalletBalance();
  const pointsQuery = useQuery({
    queryKey: queryKeys.points.balance,
    queryFn: fetchPointsBalance,
  });
  const available = balance?.balances?.available ?? 0;
  const fmt = useCurrencyFormatter();

  const benefits = useMemo(
    () => [
      {
        icon: "flash-outline" as const,
        title: t("wallet.benefitBookOneTap"),
        text: t("wallet.benefitBookOneTapText"),
      },
      {
        icon: "time-outline" as const,
        title: t("wallet.benefitFasterCheckout"),
        text: t("wallet.benefitFasterCheckoutText"),
      },
      {
        icon: "shield-checkmark-outline" as const,
        title: t("wallet.benefitSecureSpending"),
        text: t("wallet.benefitSecureSpendingText"),
      },
      {
        icon: "list-outline" as const,
        title: t("wallet.benefitClearHistory"),
        text: t("wallet.benefitClearHistoryText"),
      },
    ],
    [t]
  );

  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.iconPrimary} />
      }
    >
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{t("wallet.availableBalance")}</Text>
        {isLoading && !balance ? (
          <View style={styles.balanceSkeleton} />
        ) : (
          <Text style={styles.balanceValue}>
            {fmt(available, { currency: balance?.currency })}
          </Text>
        )}
        {(balance?.balances?.pending_topup ?? 0) > 0 && (
          <Text style={styles.pendingText}>
            {t("wallet.pendingTopUp", {
              amount: fmt(balance!.balances.pending_topup, { currency: balance?.currency }),
              defaultValue: "{{amount}} pending",
            })}
          </Text>
        )}
        <Pressable
          style={styles.addFundsBtn}
          onPress={() => navigation.navigate("WalletTopUp", undefined)}
        >
          <Ionicons name="add-circle" size={20} color={c.brandTextOn} />
          <Text style={styles.addFundsText}>{t("wallet.addFunds")}</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>{t("wallet.whyUseWallet")}</Text>
      {benefits.map((b) => (
        <View key={b.title} style={styles.benefitRow}>
          <View style={styles.benefitIcon}>
            <Ionicons name={b.icon} size={22} color={c.iconPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.benefitTitle}>{b.title}</Text>
            <Text style={styles.benefitText}>{b.text}</Text>
          </View>
        </View>
      ))}

      <View
        style={[
          styles.benefitRow,
          { marginBottom: space.md, backgroundColor: c.brandSubtle, borderColor: c.brandAccent },
        ]}
      >
        <View style={styles.benefitIcon}>
          <Ionicons name="star" size={22} color={c.iconPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.benefitTitle}>
            {t("points.walletTitle", { defaultValue: "NetQwix points" })}
          </Text>
          <Text style={styles.benefitText}>
            {t("points.walletBalance", {
              defaultValue: "{{balance}} pts · redeem {{block}} for ${{dollars}}",
              balance: pointsQuery.data?.balance ?? 0,
              block: pointsQuery.data?.redeemBlockPoints ?? 100,
              dollars: pointsQuery.data?.walletCreditPerBlock ?? 5,
            })}
          </Text>
        </View>
        <Pressable onPress={() => navigation.navigate("PointsActivity")}>
          <Text style={{ color: c.brandAccent, fontWeight: "600" }}>
            {t("points.view", { defaultValue: "View" })}
          </Text>
        </Pressable>
      </View>

      <View style={styles.menuSection}>
        <MenuRow
          icon="time-outline"
          label={t("wallet.activity")}
          sub={t("wallet.activitySub")}
          onPress={() => navigation.navigate("WalletActivity")}
        />
        <MenuRow
          icon="card-outline"
          label={t("wallet.cards.title", { defaultValue: "Payment methods" })}
          sub={t("wallet.cards.sub", { defaultValue: "Manage saved cards and Apple/Google Pay" })}
          onPress={() => navigation.navigate("WalletPaymentMethods")}
        />
        <MenuRow
          icon="refresh-outline"
          label={t("wallet.autoTopUp.menuLabel", { defaultValue: "Auto top-up" })}
          sub={t("wallet.autoTopUp.menuSub", { defaultValue: "Reload automatically when low" })}
          onPress={() => navigation.navigate("WalletAutoTopUp")}
        />
        <MenuRow
          icon="lock-closed-outline"
          label={t("wallet.security")}
          sub={balance?.pinSet ? t("wallet.pinSet") : t("wallet.pinNotSet")}
          onPress={() => navigation.navigate("WalletSecurity")}
        />
      </View>
    </ScrollView>
  );
}

function MenuRow({
  icon,
  label,
  sub,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  onPress: () => void;
}) {
  const c = useThemeColors();
  const styles = useWalletHomeStyles();

  return (
    <Pressable style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.85 }]} onPress={onPress}>
      <Ionicons name={icon} size={22} color={c.iconPrimary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.menuLabel}>{label}</Text>
        <Text style={styles.menuSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
    </Pressable>
  );
}

export function WalletHomeScreen(props: Props) {
  const { t } = useTranslation();
  useShellHeaderTitle(t("wallet.title"));
  const { accountType } = useAuth();
  const insets = useSafeAreaInsets();
  const isTrainer = accountType === AccountType.TRAINER;
  const styles = useWalletHomeStyles();

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {isTrainer ? <TrainerWalletHome navigation={props.navigation} /> : <TraineeWalletHome {...props} />}
    </View>
  );
}
