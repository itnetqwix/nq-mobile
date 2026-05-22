import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { type AppColors, radii, space, typography } from "../../../theme";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import {
  getTrainerAvgRating,
  getTrainerCategories,
  getTrainerCompletedSessionCount,
  getTrainerHourlyRate,
  getTrainerName,
  getTrainerReviewCount,
  isTrainerVerified,
} from "../lib/trainerUtils";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { FavoriteHeartButton } from "../../dashboard/components/trainee/FavoriteHeartButton";
import { FriendSocialStrip } from "../../dashboard/components/trainee/FriendSocialStrip";

function Avatar({
  uri,
  name,
  size = 64,
  styles: st,
}: {
  uri?: string;
  name?: string;
  size?: number;
  styles: ReturnType<typeof makeCardStyles>;
}) {
  const [failed, setFailed] = React.useState(false);
  const url = getS3ImageUrl(uri);
  if (!url || failed) {
    return (
      <View style={[st.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[st.avatarInitial, { fontSize: size * 0.38 }]}>
          {(name ?? "?")[0]?.toUpperCase()}
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: url }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      onError={() => setFailed(true)}
    />
  );
}

export type TrainerBrowseCardProps = {
  trainer: Record<string, unknown>;
  themeColors: AppColors;
  onPress: (t: Record<string, unknown>) => void;
  onBook: (t: Record<string, unknown>) => void;
  onSchedule: (t: Record<string, unknown>) => void;
  highlightCategory?: string;
  compact?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (trainer: Record<string, unknown>) => void;
};

export function TrainerBrowseCard({
  trainer,
  themeColors,
  onPress,
  onBook,
  onSchedule,
  highlightCategory,
  compact,
  isFavorite,
  onToggleFavorite,
}: TrainerBrowseCardProps) {
  const { t } = useAppTranslation();
  const styles = makeCardStyles(themeColors);
  const name = getTrainerName(trainer);
  const showOnline = !!(trainer as { is_online?: boolean })?.is_online;
  const cats = getTrainerCategories(trainer);
  const categoryLabel =
    highlightCategory ||
    cats.slice(0, 2).join(" • ") ||
    "";
  const rating = getTrainerAvgRating(trainer);
  const reviewCount = getTrainerReviewCount(trainer);
  const completedCount = getTrainerCompletedSessionCount(trainer);
  const verified = isTrainerVerified(trainer);
  const hourly = getTrainerHourlyRate(trainer);
  const slotsCount = Array.isArray(trainer?.slots) ? (trainer.slots as unknown[]).length : null;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <Pressable
        style={({ pressed }) => [pressed && { opacity: 0.92 }]}
        onPress={() => onPress(trainer)}
        accessibilityRole="button"
        accessibilityLabel={t("bookExpert.viewProfileA11y", { name })}
      >
        <View style={styles.cardRow}>
          <View>
            <Avatar uri={trainer?.profile_picture as string} name={name} size={compact ? 52 : 64} styles={styles} />
            {showOnline ? (
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.livePillText}>{t("traineeDiscover.liveNow")}</Text>
              </View>
            ) : (
              <View style={styles.offlinePill}>
                <Text style={styles.offlinePillText}>{t("traineeDiscover.offline")}</Text>
              </View>
            )}
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.trainerName} numberOfLines={1}>
                {name}
              </Text>
              {verified ? (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={12} color={themeColors.success} />
                  <Text style={styles.verifiedText}>{t("traineeDiscover.verified")}</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={18} color={themeColors.textMuted} />
            </View>
            {!!categoryLabel && (
              <Text style={styles.trainerCat} numberOfLines={2}>
                {categoryLabel}
              </Text>
            )}
            {rating != null && (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={13} color={themeColors.warning} />
                <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
                {reviewCount > 0 ? (
                  <Text style={styles.reviewsHint}>
                    {t("traineeDiscover.reviewCount", { count: reviewCount })}
                  </Text>
                ) : null}
              </View>
            )}
            {completedCount > 0 ? (
              <Text style={styles.sessionsText}>
                {t("traineeDiscover.sessionsCompleted", { count: completedCount })}
              </Text>
            ) : null}
            {hourly != null && (
              <Text style={styles.rateText}>
                {t("traineeDiscover.fromRate", { rate: hourly.toFixed(0) })}
              </Text>
            )}
            {!compact && slotsCount !== null && slotsCount > 0 && (
              <Text style={styles.slotsText}>
                {t("bookExpert.slotsAvailable", { count: slotsCount })}
              </Text>
            )}
            <FriendSocialStrip trainer={trainer} />
          </View>
        </View>
      </Pressable>
      <View style={styles.cardFooter}>
        <View style={styles.actionRow}>
          {onToggleFavorite ? (
            <FavoriteHeartButton
              compact
              active={!!isFavorite}
              onPress={() => onToggleFavorite(trainer)}
              accessibilityLabel={t("traineeDiscover.favoriteA11y", { name })}
            />
          ) : (
            <View style={styles.heartSpacer} />
          )}
          <Pressable
            style={[styles.actionBtn, styles.actionBtnFlex, !showOnline && styles.actionBtnDisabled]}
            onPress={() => showOnline && onBook(trainer)}
            disabled={!showOnline}
          >
            <Ionicons name="flash" size={15} color={themeColors.brandTextOn} />
            <Text style={styles.actionBtnText} numberOfLines={1}>
              {t("bookExpert.instant")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnOutline, styles.actionBtnFlex]}
            onPress={() => onSchedule(trainer)}
          >
            <Ionicons name="calendar-outline" size={15} color={themeColors.brandNavy} />
            <Text style={[styles.actionBtnText, styles.actionBtnTextOutline]} numberOfLines={1}>
              {t("traineeDiscover.bookSession")}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function makeCardStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radii.lg,
      padding: space.md,
      borderWidth: 1,
      borderColor: colors.border,
      position: "relative",
    },
    verifiedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radii.pill,
      backgroundColor: `${colors.success}18`,
    },
    verifiedText: { ...typography.caption, color: colors.success, fontSize: 10, fontWeight: "700" },
    sessionsText: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
    cardCompact: { padding: space.sm },
    cardRow: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
    cardInfo: { flex: 1, minWidth: 0 },
    cardTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    trainerName: { ...typography.titleSm, color: colors.text, flex: 1 },
    trainerCat: { ...typography.bodySm, color: colors.textMuted, marginTop: 3 },
    ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    ratingText: { ...typography.bodySm, fontWeight: "600", color: colors.textSecondary },
    reviewsHint: { ...typography.caption, color: colors.textMuted },
    rateText: { ...typography.caption, color: colors.brandNavy, marginTop: 2, fontWeight: "600" },
    slotsText: { ...typography.caption, color: colors.success, marginTop: 3, fontWeight: "500" },
    cardFooter: {
      marginTop: space.md,
      paddingTop: space.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderSubtle,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    heartSpacer: { width: 40 },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: radii.pill,
      backgroundColor: colors.brandNavy,
      minHeight: 40,
    },
    actionBtnFlex: { flex: 1, minWidth: 0 },
    actionBtnDisabled: { opacity: 0.45 },
    actionBtnOutline: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.brandNavy,
    },
    actionBtnText: { fontSize: 12, fontWeight: "600", color: colors.brandTextOn, flexShrink: 1 },
    actionBtnTextOutline: { color: colors.brandNavy },
    livePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      alignSelf: "center",
      marginTop: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.pill,
      backgroundColor: `${colors.success}18`,
    },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
    livePillText: { ...typography.caption, color: colors.success, fontWeight: "700", fontSize: 10 },
    offlinePill: {
      alignSelf: "center",
      marginTop: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceMuted,
    },
    offlinePillText: { ...typography.caption, color: colors.textMuted, fontSize: 10 },
    avatarFallback: { backgroundColor: colors.brandNavy, alignItems: "center", justifyContent: "center" },
    avatarInitial: { color: colors.brandTextOn, fontWeight: "700" },
  });
}
