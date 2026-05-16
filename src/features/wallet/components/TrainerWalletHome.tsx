import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { useWalletBalance } from "../hooks/useWalletBalance";
import type { WalletStackParamList } from "../navigation/WalletNavigator";
import { TrainerEarningsPanel } from "./TrainerEarningsPanel";

type Props = {
  navigation: NativeStackNavigationProp<WalletStackParamList, "WalletHome">;
};

export function TrainerWalletHome({ navigation }: Props) {
  const c = useThemeColors();
  const styles = useThemedStyles((colors) =>
    StyleSheet.create({
      scroll: { padding: space.md, paddingBottom: space.xl },
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
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.brandNavy} />
      }
    >
      <TrainerEarningsPanel />

      <Pressable
        style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.85 }]}
        onPress={() => navigation.navigate("WalletActivity")}
      >
        <Ionicons name="time-outline" size={22} color={c.brandNavy} />
        <View style={{ flex: 1 }}>
          <Text style={styles.menuLabel}>Earnings activity</Text>
          <Text style={styles.menuSub}>Payouts and session payments</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
      </Pressable>
    </ScrollView>
  );
}
