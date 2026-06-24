import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { OnlinePulseBorder, VerifiedBadge } from "../../../components/ui";
import { type AppColors, radii, space, typography } from "../../../theme";
import { ProfileAvatar } from "../../../components/ui/ProfileAvatar";
import {
  getTrainerAvgRating,
  getTrainerCategories,
  getTrainerCompletedSessionCount,
  getTrainerHourlyRate,
  getTrainerName,
  getTrainerNextSlots,
  getTrainerReviewCount,
  getTrainerTodaySlotsCount,
  isTrainerVerified,
} from "../lib/trainerUtils";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { FavoriteHeartButton } from "../../dashboard/components/trainee/FavoriteHeartButton";
import { FriendSocialStrip } from "../../dashboard/components/trainee/FriendSocialStrip";

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
  /** When provided, renders a small "compare" pin in the card corner. */
  isComparePinned?: boolean;
  onToggleCompare?: (trainer: Record<string, unknown>) => void;
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
  isComparePinned,
  onToggleCompare,
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
  const todaySlotsCount = getTrainerTodaySlotsCount(trainer);
  const nextSlots = React.useMemo(() => getTrainerNextSlots(trainer, 2), [trainer]);

  return (
    <OnlinePulseBorder active={showOnline && !compact} borderRadius={radii.lg}>
    <View style={[styles.card, compact && styles.cardCompact, showOnline && styles.cardOnline]}>
      {onToggleCompare && !compact ? (
        <Pressable
          onPress={() => onToggleCompare(trainer)}
          style={({ pressed }) => [
            styles.compareCornerBtn,
            {
              backgroundColor: isComparePinned ? themeColors.brandNavy : themeColors.surface,
              borderColor: isComparePinned ? themeColors.brandNavy : themeColors.border,
            },
            pressed && { opacity: 0.8 },
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: !!isComparePinned }}
          accessibilityLabel={t(
            isComparePinned
              ? "bookExpert.compareRemoveA11y"
              : "bookExpert.compareAddA11y",
            { name }
          )}
          hitSlop={6}
        >
          <Ionicons
            name={isComparePinned ? "checkmark" : "git-compare-outline"}
            size={14}
            color={isComparePinned ? themeColors.brandTextOn : themeColors.brandNavy}
          />
          <Text
            style={[
              styles.compareCornerText,
              { color: isComparePinned ? themeColors.brandTextOn : themeColors.brandNavy },
            ]}
          >
            {t(isComparePinned ? "bookExpert.compareAdded" : "bookExpert.compare")}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        style={({ pressed }) => [pressed && { opacity: 0.92 }]}
        onPress={() => onPress(trainer)}
        accessibilityRole="button"
        accessibilityLabel={t("bookExpert.viewProfileA11y", { name })}
      >
        <View style={styles.cardRow}>
          <View>
            <ProfileAvatar user={trainer as Record<string, unknown>} name={name} size={compact ? 44 : 52} />
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
                  <VerifiedBadge size={12} tint={themeColors.success} />
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
            <View style={styles.metaRow}>
              {rating != null ? (
                <View style={styles.metaPill}>
                  <Ionicons name="star" size={12} color={themeColors.warning} />
                  <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
                  {reviewCount > 0 ? (
                    <Text style={styles.reviewsHint}>
                      {t("traineeDiscover.reviewCount", { count: reviewCount })}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {hourly != null ? (
                <View style={[styles.metaPill, styles.ratePill]}>
                  <Text style={styles.rateText}>
                    {t("traineeDiscover.fromRate", { rate: hourly.toFixed(0) })}
                  </Text>
                </View>
              ) : null}
              {completedCount > 0 ? (
                <Text style={styles.sessionsText}>
                  {t("traineeDiscover.sessionsCompleted", { count: completedCount })}
                </Text>
              ) : null}
            </View>
            {!compact && todaySlotsCount !== null && todaySlotsCount > 0 ? (
              <Text style={styles.slotsText}>
                {t("bookExpert.slotsAvailableToday", { count: todaySlotsCount })}
              </Text>
            ) : !compact && todaySlotsCount === 0 ? (
              <Pressable onPress={() => onSchedule(trainer)} accessibilityRole="button">
                <Text style={styles.slotsHintMuted}>
                  {t("bookExpert.noSlotsTodaySeeCalendar")}
                </Text>
              </Pressable>
            ) : null}
            <FriendSocialStrip trainer={trainer} />
          </View>
        </View>
      </Pressable>
      {!compact && nextSlots.length > 0 ? (
        <View style={styles.slotsStrip}>
          <Ionicons name="time-outline" size={13} color={themeColors.textMuted} />
          <Text style={styles.slotsStripHint}>{t("bookExpert.todayOpenLabel")}</Text>
          {nextSlots.map((slot) => (
            <Pressable
              key={slot.iso || `${slot.label}-${slot.time}`}
              onPress={() => onSchedule(trainer)}
              style={styles.slotChip}
              accessibilityRole="button"
              accessibilityLabel={t("bookExpert.bookSlotA11y", {
                day: slot.label,
                time: slot.time,
              })}
            >
              <Text style={styles.slotChipDay}>{slot.label}</Text>
              <Text style={styles.slotChipTime}>{slot.time}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
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
            <Ionicons name="flash" size={14} color={themeColors.brandTextOn} />
            <Text style={styles.actionBtnText} numberOfLines={1}>
              {t("bookExpert.instant")}
            </Text>
          </Pressable>
          <Pressable
            testID="book-expert-schedule"
            style={[styles.actionBtn, styles.actionBtnOutline, styles.actionBtnFlex]}
            onPress={() => onSchedule(trainer)}
          >
            <Ionicons name="calendar-outline" size={14} color={themeColors.brandNavy} />
            <Text style={[styles.actionBtnText, styles.actionBtnTextOutline]} numberOfLines={1}>
              {t("traineeDiscover.bookSession")}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
    </OnlinePulseBorder>
  );
}

function makeCardStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radii.lg,
      padding: space.sm,
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
    cardCompact: { padding: space.xs },
    cardOnline: {
      borderColor: "transparent",
    },
    cardRow: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
    cardInfo: { flex: 1, minWidth: 0 },
    cardTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 6,
    },
    trainerName: { ...typography.bodySm, color: colors.text, flex: 1, fontWeight: "700" },
    trainerCat: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 6,
      marginTop: 4,
    },
    metaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ratePill: {
      backgroundColor: colors.brandSubtle,
    },
    ratingText: { ...typography.caption, fontWeight: "800", color: colors.text },
    reviewsHint: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
    sessionsText: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
    rateText: { ...typography.caption, color: colors.brandNavy, fontWeight: "800", fontSize: 11 },
    slotsText: { ...typography.caption, color: colors.success, marginTop: 2, fontWeight: "500", fontSize: 11 },
    slotsHintMuted: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: 3,
      textDecorationLine: "underline",
    },
    slotsStrip: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 4,
      marginTop: space.xs,
    },
    slotsStripHint: {
      ...typography.caption,
      color: colors.textMuted,
      fontWeight: "600",
      marginRight: 2,
    },
    slotChip: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.pill,
      backgroundColor: colors.brandAccentSubtle,
      borderWidth: 1,
      borderColor: colors.brandAccent,
    },
    slotChipDay: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.brandNavy,
      letterSpacing: 0.2,
      textTransform: "uppercase",
    },
    slotChipTime: { fontSize: 11, fontWeight: "600", color: colors.brandNavy },
    compareCornerBtn: {
      position: "absolute",
      top: 10,
      right: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.pill,
      borderWidth: 1,
      zIndex: 2,
    },
    compareCornerText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
    cardFooter: {
      marginTop: space.sm,
      paddingTop: space.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderSubtle,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    heartSpacer: { width: 34 },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: radii.pill,
      backgroundColor: colors.brandNavy,
      minHeight: 34,
    },
    actionBtnFlex: { flex: 1, minWidth: 0 },
    actionBtnDisabled: { opacity: 0.45 },
    actionBtnOutline: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.brandNavy,
    },
    actionBtnText: { fontSize: 11, fontWeight: "600", color: colors.brandTextOn, flexShrink: 1 },
    actionBtnTextOutline: { color: colors.brandNavy },
    livePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      alignSelf: "center",
      marginTop: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radii.pill,
      backgroundColor: `${colors.success}18`,
    },
    liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.success },
    livePillText: { ...typography.caption, color: colors.success, fontWeight: "700", fontSize: 9 },
    offlinePill: {
      alignSelf: "center",
      marginTop: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceMuted,
    },
    offlinePillText: { ...typography.caption, color: colors.textMuted, fontSize: 9 },
    avatarFallback: { backgroundColor: colors.brandNavy, alignItems: "center", justifyContent: "center" },
    avatarInitial: { color: colors.brandTextOn, fontWeight: "700" },
  });
}
