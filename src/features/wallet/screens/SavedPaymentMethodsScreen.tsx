/**
 * Saved Payment Methods screen.
 *
 * Lists every card / wallet token the user has added to NetQwix. We render
 * the brand icon + masked last-4 so users can pick the right card without
 * exposing the full PAN. The default card is highlighted with a pill and is
 * pinned to the top of the list so it's easy to find.
 *
 * Why a dedicated screen?
 *   - Settings → Privacy → Cards is a standard pattern users expect.
 *   - Auto top-up needs to reference a `paymentMethodId`; this is where
 *     they discover/manage that linkage.
 *   - GDPR: users have the right to remove individual stored methods.
 *
 * The API is best-effort — if the server hasn't shipped the endpoint yet
 * we render the empty state instead of an error toast.
 */

import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback } from "react";
import { FlashList } from "@shopify/flash-list";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
  EmptyState,
  MorphRefreshScrollSurface,
  PaymentMethodRowSkeleton,
  Pill,
  SkeletonGroup,
} from "../../../components/ui";
import {
  FLASHLIST_PERF_DEFAULTS,
} from "../../../lib/lists/flatListPerf";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { queryKeys } from "../../../lib/queryKeys";
import {
  deleteSavedPaymentMethod,
  fetchSavedPaymentMethods,
  makePaymentMethodDefault,
  type SavedPaymentMethod,
} from "../walletApi";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { WalletStackParamList } from "../navigation/WalletNavigator";

type Props = NativeStackScreenProps<WalletStackParamList, "WalletPaymentMethods">;

/**
 * Card-brand → icon mapping. Ionicons doesn't ship per-brand glyphs so we
 * fall back to generic `card-outline` for unrecognised brands; the brand
 * label below the last-4 still clarifies which card it is.
 */
function brandLabel(brand: string): string {
  switch (brand) {
    case "visa":
      return "Visa";
    case "mastercard":
      return "Mastercard";
    case "amex":
      return "American Express";
    case "discover":
      return "Discover";
    case "diners":
      return "Diners Club";
    case "jcb":
      return "JCB";
    case "unionpay":
      return "UnionPay";
    default:
      return brand.toUpperCase();
  }
}

function brandColor(brand: string): string {
  switch (brand) {
    case "visa":
      return "#1A1F71";
    case "mastercard":
      return "#EB001B";
    case "amex":
      return "#006FCF";
    case "discover":
      return "#FF6F00";
    default:
      return "#3A415A";
  }
}

function PaymentRow({
  method,
  onMakeDefault,
  onRemove,
}: {
  method: SavedPaymentMethod;
  onMakeDefault: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const styles = usePaymentMethodStyles();
  const c = useThemeColors();
  const { t } = useTranslation();
  const isWallet = !!method.walletType;
  const iconName: keyof typeof Ionicons.glyphMap = isWallet
    ? method.walletType === "apple_pay"
      ? "logo-apple"
      : "wallet-outline"
    : "card-outline";

  const label = isWallet
    ? method.walletType === "apple_pay"
      ? "Apple Pay"
      : "Google Pay"
    : brandLabel(method.brand);

  const expiry =
    method.expMonth && method.expYear
      ? `${String(method.expMonth).padStart(2, "0")}/${String(method.expYear).slice(-2)}`
      : null;

  return (
    <View style={styles.row}>
      <View style={[styles.brandBox, { backgroundColor: brandColor(method.brand) }]}>
        <Ionicons name={iconName} size={22} color="#fff" />
      </View>
      <View style={styles.rowInfo}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.brandText}>{label}</Text>
          {method.isDefault ? (
            <Pill label={t("wallet.cards.default", { defaultValue: "Default" })} tone="success" />
          ) : null}
        </View>
        <Text style={styles.last4}>•••• {method.last4}</Text>
        {expiry ? <Text style={styles.meta}>{t("wallet.cards.expires", { value: expiry, defaultValue: "Expires {{value}}" })}</Text> : null}
      </View>
      <View style={styles.rowActions}>
        {!method.isDefault ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("wallet.cards.makeDefault", { defaultValue: "Make default" })}
            onPress={() => onMakeDefault(method.id)}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="star-outline" size={18} color={c.iconPrimary} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("wallet.cards.remove", { defaultValue: "Remove card" })}
          onPress={() => onRemove(method.id)}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="trash-outline" size={18} color={c.danger} />
        </Pressable>
      </View>
    </View>
  );
}

function usePaymentMethodStyles() {
  return useThemedStyles((c) =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: c.background },
      list: { padding: space.md, gap: space.sm },
      row: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        padding: space.md,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surfaceElevated,
        marginBottom: space.sm,
      },
      brandBox: {
        width: 44,
        height: 32,
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center",
      },
      rowInfo: { flex: 1, gap: 2 },
      rowTitleLine: { flexDirection: "row", alignItems: "center", gap: space.sm },
      brandText: { ...typography.bodyMd, fontWeight: "700", color: c.text },
      last4: { ...typography.bodySm, color: c.text, letterSpacing: 1 },
      meta: { ...typography.caption, color: c.textMuted, marginTop: 2 },
      rowActions: { flexDirection: "row", gap: space.xs },
      iconBtn: { padding: 8 },
      center: { flex: 1, alignItems: "center", justifyContent: "center" },
    })
  );
}

export function SavedPaymentMethodsScreen({ navigation }: Props) {
  const styles = usePaymentMethodStyles();
  const c = useThemeColors();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.wallet.paymentMethods,
    queryFn: fetchSavedPaymentMethods,
    staleTime: 60_000,
  });

  const makeDefaultMut = useMutation({
    mutationFn: makePaymentMethodDefault,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.wallet.paymentMethods }),
  });

  const removeMut = useMutation({
    mutationFn: deleteSavedPaymentMethod,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.wallet.paymentMethods }),
  });

  const handleMakeDefault = useCallback(
    (id: string) => {
      makeDefaultMut.mutate(id);
    },
    [makeDefaultMut]
  );

  const handleRemove = useCallback(
    (id: string) => {
      Alert.alert(
        t("wallet.cards.removeTitle", { defaultValue: "Remove this card?" }),
        t("wallet.cards.removeBody", {
          defaultValue: "You can re-add it any time. Active subscriptions on this card will be paused.",
        }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("wallet.cards.remove", { defaultValue: "Remove" }),
            style: "destructive",
            onPress: () => removeMut.mutate(id),
          },
        ]
      );
    },
    [removeMut, t]
  );

  if (isLoading) {
    return (
      <View style={styles.root}>
        <SkeletonGroup
          count={3}
          gap={space.sm}
          style={{ padding: space.md }}
          renderRow={() => <PaymentMethodRowSkeleton />}
        />
      </View>
    );
  }

  /**
   * Sort default first → newest added → fallback to brand sort. The user
   * sees the most relevant card at the top without us needing a separate
   * "Default" section header.
   */
  const sorted = [...(data ?? [])].sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (b.isDefault && !a.isDefault) return 1;
    return (b.addedAt ?? "").localeCompare(a.addedAt ?? "");
  });

  return (
    <View style={styles.root}>
      <MorphRefreshScrollSurface onRefresh={refetch} externalRefreshing={isRefetching}>
        {({ refreshControl, onScroll, scrollEventThrottle }) => (
      <FlashList
        data={sorted}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        refreshControl={refreshControl}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        {...FLASHLIST_PERF_DEFAULTS}
        renderItem={({ item }) => (
          <PaymentRow method={item} onMakeDefault={handleMakeDefault} onRemove={handleRemove} />
        )}
        ListHeaderComponent={
          <Pressable
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: space.sm,
                padding: space.md,
                marginBottom: space.sm,
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.brandSubtle,
              },
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => navigation.navigate("WalletTopUp")}
          >
            <Ionicons name="add-circle-outline" size={22} color={c.brandNavy} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.bodyMd, fontWeight: "700", color: c.text }}>
                {t("wallet.cards.addViaTopUp", { defaultValue: "Add a card" })}
              </Text>
              <Text style={{ ...typography.caption, color: c.textMuted, marginTop: 2 }}>
                {t("wallet.cards.addViaTopUpSub", {
                  defaultValue: "Top up your wallet — save your card during checkout",
                })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </Pressable>
        }
        ListEmptyComponent={
          <EmptyState
            icon="card-outline"
            title={t("wallet.cards.emptyTitle", { defaultValue: "No saved cards yet" })}
            description={t("wallet.cards.emptyDescription", {
              defaultValue: "When you pay with a card on NetQwix, you can save it here for faster checkout.",
            })}
          />
        }
      />
        )}
      </MorphRefreshScrollSurface>
    </View>
  );
}
