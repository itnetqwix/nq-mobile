import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccountType } from "../../../constants/accountType";
import { useAuth } from "../../auth/context/AuthContext";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { useWalletBalance } from "../hooks/useWalletBalance";
import type { WalletStackParamList } from "../navigation/WalletNavigator";
import { TrainerWalletHome } from "../components/TrainerWalletHome";

const BENEFITS = [
  {
    icon: "flash-outline" as const,
    title: "Book in one tap",
    text: "Pay for lessons from your balance without entering card details every time.",
  },
  {
    icon: "time-outline" as const,
    title: "Faster checkout",
    text: "Instant lessons confirm quicker when your wallet has enough funds.",
  },
  {
    icon: "shield-checkmark-outline" as const,
    title: "Secure spending",
    text: "A 6-digit PIN protects larger payments and withdrawals.",
  },
  {
    icon: "list-outline" as const,
    title: "Clear history",
    text: "See every top-up and payment in your activity feed.",
  },
];

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
  const c = useThemeColors();
  const styles = useWalletHomeStyles();
  const { data: balance, isLoading, isRefetching, refetch } = useWalletBalance();
  const available = balance?.balances?.available ?? 0;

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.iconPrimary} />
      }
    >
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available balance</Text>
        {isLoading && !balance ? (
          <View style={styles.balanceSkeleton} />
        ) : (
          <Text style={styles.balanceValue}>${available.toFixed(2)}</Text>
        )}
        {(balance?.balances?.pending_topup ?? 0) > 0 && (
          <Text style={styles.pendingText}>
            ${balance!.balances.pending_topup.toFixed(2)} pending top-up
          </Text>
        )}
        <Pressable
          style={styles.addFundsBtn}
          onPress={() => navigation.navigate("WalletTopUp", undefined)}
        >
          <Ionicons name="add-circle" size={20} color={c.brandTextOn} />
          <Text style={styles.addFundsText}>Add funds</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Why use your wallet?</Text>
      {BENEFITS.map((b) => (
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

      <View style={styles.menuSection}>
        <MenuRow
          icon="time-outline"
          label="Activity"
          sub="Top-ups and payments"
          onPress={() => navigation.navigate("WalletActivity")}
        />
        <MenuRow
          icon="lock-closed-outline"
          label="Security"
          sub={balance?.pinSet ? "PIN is set" : "Set your wallet PIN"}
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
