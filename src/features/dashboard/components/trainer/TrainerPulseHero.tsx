import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Skeleton } from "../../../../components/ui";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { queryKeys } from "../../../../lib/queryKeys";
import { radii, space, typography, useThemedStyles, useThemeColors } from "../../../../theme";
import { fetchTrainerPulse } from "../../../wallet/walletApi";

type Props = {
  onOpenEarnings?: () => void;
  onOpenStudents?: () => void;
};

/**
 * Money + people first. Sits above everything else on the trainer
 * dashboard so the moment a coach opens the app they see what they made
 * this week and how many of their students are active. Designed to be a
 * single horizontal strip; tapping either tile drills into the relevant
 * detail surface.
 */
export function TrainerPulseHero({ onOpenEarnings, onOpenStudents }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.wallet.trainerPulse,
    queryFn: fetchTrainerPulse,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <View style={styles.row}>
        <Skeleton width="48%" height={92} radius={radii.lg} />
        <Skeleton width="48%" height={92} radius={radii.lg} />
      </View>
    );
  }

  const currency = data?.currency || "USD";
  const earnings = data?.earnings_this_week ?? 0;
  const delta = data?.delta_amount ?? 0;
  const deltaPct = data?.delta_percent;
  const active = data?.active_students_30d ?? 0;
  const newStudents = data?.new_students_this_week ?? 0;
  const sessions = data?.sessions_this_week ?? 0;

  const trendUp = delta >= 0;

  return (
    <View style={styles.row}>
      <PulseCard
        accent={c.brandNavy}
        onPress={onOpenEarnings}
        accessibilityLabel={t("trainerDashboard.pulseEarningsA11y", {
          amount: `${currency} ${earnings.toFixed(0)}`,
        })}
      >
        <View style={styles.headerRow}>
          <Ionicons name="trending-up" size={16} color={c.brandTextOn} />
          <Text style={[styles.cardLabel, { color: `${c.brandTextOn}cc` }]}>
            {t("trainerDashboard.pulseEarningsLabel")}
          </Text>
        </View>
        <Text style={[styles.amount, { color: c.brandTextOn }]}>
          ${earnings.toFixed(earnings >= 1000 ? 0 : 2)}
        </Text>
        <View style={styles.footerRow}>
          <Ionicons
            name={trendUp ? "arrow-up" : "arrow-down"}
            size={11}
            color={trendUp ? c.success : c.warning}
          />
          <Text
            style={[
              styles.footerText,
              { color: trendUp ? c.success : c.warning },
            ]}
          >
            {deltaPct == null
              ? t("trainerDashboard.pulseFirstWeek")
              : t("trainerDashboard.pulseVsLastWeek", {
                  sign: deltaPct >= 0 ? "+" : "",
                  pct: Math.abs(deltaPct),
                })}
          </Text>
          <Text style={[styles.footerSub, { color: `${c.brandTextOn}99` }]} numberOfLines={1}>
            · {sessions} {t("trainerDashboard.pulseSessions")}
          </Text>
        </View>
      </PulseCard>

      <PulseCard
        accent={c.surfaceElevated}
        onPress={onOpenStudents}
        accessibilityLabel={t("trainerDashboard.pulseStudentsA11y", { count: active })}
        outlined
      >
        <View style={styles.headerRow}>
          <Ionicons name="people-outline" size={16} color={c.brandAccent} />
          <Text style={[styles.cardLabel, { color: c.textMuted }]}>
            {t("trainerDashboard.pulseStudentsLabel")}
          </Text>
        </View>
        <Text style={[styles.amount, { color: c.text }]}>{active}</Text>
        <View style={styles.footerRow}>
          {newStudents > 0 ? (
            <>
              <Ionicons name="sparkles" size={11} color={c.success} />
              <Text style={[styles.footerText, { color: c.success }]}>
                {t("trainerDashboard.pulseNewStudents", { count: newStudents })}
              </Text>
            </>
          ) : (
            <Text style={[styles.footerText, { color: c.textMuted }]}>
              {t("trainerDashboard.pulseStudentsHint")}
            </Text>
          )}
        </View>
      </PulseCard>
    </View>
  );
}

function PulseCard({
  children,
  onPress,
  accent,
  outlined,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  accent: string;
  outlined?: boolean;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  const c = useThemeColors();
  const Wrap: any = onPress ? Pressable : View;
  return (
    <Wrap
      style={({ pressed }: { pressed: boolean }) => [
        styles.card,
        outlined
          ? { backgroundColor: accent, borderColor: c.border, borderWidth: 1 }
          : { backgroundColor: accent },
        pressed && onPress && { opacity: 0.92 },
      ]}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Wrap>
  );
}

function useStyles() {
  return useThemedStyles(() =>
    StyleSheet.create({
      row: {
        flexDirection: "row",
        gap: space.sm,
      },
      card: {
        flex: 1,
        borderRadius: radii.lg,
        paddingVertical: space.md,
        paddingHorizontal: space.md,
        gap: 6,
        minHeight: 96,
      },
      headerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
      cardLabel: {
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.6,
      },
      amount: { ...typography.titleLg, fontWeight: "800" },
      footerRow: { flexDirection: "row", alignItems: "center", gap: 4 },
      footerText: { fontSize: 11, fontWeight: "700" },
      footerSub: { fontSize: 11, fontWeight: "600", flexShrink: 1 },
    })
  );
}
