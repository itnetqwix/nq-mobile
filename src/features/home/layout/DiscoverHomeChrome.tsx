import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Skeleton } from "../../../components/ui";
import { AccountType, type AccountTypeValue } from "../../../constants/accountType";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { queryKeys } from "../../../lib/queryKeys";
import { useCompactA11yGuard } from "../../../lib/layout";
import { space, useScaledTypography, useThemeColors } from "../../../theme";
import { fetchMyTrainerStats } from "../../home/api/homeApi";
import { HomeUserAvatar } from "../../dashboard/components/home/HomeUserAvatar";
import {
  HomeCategoryChipsRow,
  type HomeCategoryChip,
} from "../components/HomeCategoryChipsRow";
import { HomeStickySearchBar } from "../components/HomeStickySearchBar";
import type { VoiceInputState } from "../../ai/useVoiceInput";
import { useMarketplaceTopPadding } from "./marketplaceLayout";

const PROFILE_AVATAR_SIZE = 58;

type Props = {
  /** @deprecated Use profileName in the profile band. Kept for callers that still pass it. */
  headline?: string;
  subline?: string;
  profilePicture?: string;
  profileName: string;
  role?: AccountTypeValue | "trainer" | "trainee";
  user?: Record<string, unknown> | null;
  onPressProfile?: () => void;
  onPressReviews?: () => void;
  searchValue?: string;
  onSearchChange?: (text: string) => void;
  onOpenFilters?: () => void;
  activeFilterCount?: number;
  categoryChips?: HomeCategoryChip[];
  selectedCategoryId?: string | null;
  onSelectCategory?: (id: string | null) => void;
  /** When true, stack header is shown — avoid double safe-area padding. */
  compactTop?: boolean;
  showSearch?: boolean;
  trailing?: React.ReactNode;
  bottomSlot?: React.ReactNode;
  voiceState?: VoiceInputState;
  onVoicePress?: () => void;
};

function readHourlyRate(user: Record<string, unknown> | null | undefined): string | null {
  if (!user) return null;
  const extra = user.extraInfo;
  if (extra && typeof extra === "object") {
    const rate = (extra as Record<string, unknown>).hourly_rate;
    if (rate != null && rate !== "") return String(rate);
  }
  const top = user.hourly_rate;
  if (top != null && top !== "") return String(top);
  return null;
}

function TrainerProfileMeta({
  user,
  onPressReviews,
}: {
  user?: Record<string, unknown> | null;
  onPressReviews?: () => void;
}) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const text = useScaledTypography();
  const hourly = readHourlyRate(user);

  const q = useQuery({
    queryKey: queryKeys.trainer.myStats,
    queryFn: fetchMyTrainerStats,
    staleTime: 60_000,
  });

  const avg = q.data?.avgRating;
  const count = q.data?.reviewCount ?? 0;
  const hasRating = avg != null && avg > 0 && count > 0;

  if (q.isLoading) {
    return (
      <View style={metaStyles.row}>
        <Skeleton width={120} height={14} radius={6} />
      </View>
    );
  }

  return (
    <View style={metaStyles.row}>
      {onPressReviews ? (
        <Pressable
          onPress={onPressReviews}
          style={({ pressed }) => [metaStyles.chip, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={t("trainerDashboard.openReviewsA11y", {
            defaultValue: "Your rating and reviews",
          })}
        >
          <Ionicons name="star" size={13} color={c.warning} />
          <Text style={[metaStyles.chipText, text.caption, { color: c.text }]}>
            {hasRating ? avg!.toFixed(1) : "—"}
          </Text>
          <Text style={[metaStyles.chipMuted, text.caption, { color: c.textMuted }]}>
            {count > 0
              ? `(${count})`
              : t("trainerDashboard.noReviewsYet", { defaultValue: "No reviews" })}
          </Text>
        </Pressable>
      ) : (
        <View style={metaStyles.chip}>
          <Ionicons name="star" size={13} color={c.warning} />
          <Text style={[metaStyles.chipText, text.caption, { color: c.text }]}>
            {hasRating ? avg!.toFixed(1) : "—"}
          </Text>
          {count > 0 ? (
            <Text style={[metaStyles.chipMuted, text.caption, { color: c.textMuted }]}>
              ({count})
            </Text>
          ) : null}
        </View>
      )}
      {hourly ? (
        <>
          <Text style={[metaStyles.dot, { color: c.textMuted }]}>•</Text>
          <View style={metaStyles.chip}>
            <Text style={[metaStyles.rate, text.caption, { color: c.brandNavy }]}>
              ${hourly}
              <Text style={{ color: c.textMuted, fontWeight: "500" }}>/hr</Text>
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const metaStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  chipText: {
    fontWeight: "700",
  },
  chipMuted: {
    fontWeight: "500",
  },
  rate: {
    fontWeight: "700",
  },
  dot: {
    fontSize: 12,
    fontWeight: "700",
  },
});

/**
 * Fixed marketplace header: profile band + search + category chips.
 */
export function DiscoverHomeChrome({
  subline,
  profilePicture,
  profileName,
  role,
  user,
  onPressProfile,
  onPressReviews,
  searchValue,
  onSearchChange,
  onOpenFilters,
  activeFilterCount,
  categoryChips,
  selectedCategoryId = null,
  onSelectCategory,
  compactTop = false,
  showSearch = true,
  trailing,
  bottomSlot,
  voiceState,
  onVoicePress,
}: Props) {
  const c = useThemeColors();
  const text = useScaledTypography();
  useCompactA11yGuard();
  const { t } = useAppTranslation();
  const topPadding = useMarketplaceTopPadding(compactTop);

  const isTrainer =
    role === AccountType.TRAINER || role === "trainer";
  const isTrainee =
    role === AccountType.TRAINEE || role === "trainee" || !isTrainer;

  const displayName = profileName?.trim() || t("dashboardHome.userDefault", { defaultValue: "Member" });

  const avatar = onPressProfile ? (
    <Pressable
      onPress={onPressProfile}
      accessibilityRole="button"
      accessibilityLabel={t("traineeDiscover.profileA11y")}
    >
      <HomeUserAvatar uri={profilePicture} name={displayName} size={PROFILE_AVATAR_SIZE} />
    </Pressable>
  ) : (
    <HomeUserAvatar uri={profilePicture} name={displayName} size={PROFILE_AVATAR_SIZE} />
  );

  return (
    <View
      style={[
        styles.band,
        {
          backgroundColor: c.homeMarketplaceBand,
          paddingTop: topPadding,
        },
      ]}
    >
      <View style={styles.topRow}>
        {avatar}
        <View style={styles.profileCol}>
          <Text
            style={[styles.name, text.titleSm, { color: c.text }]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          {isTrainer ? (
            <TrainerProfileMeta user={user} onPressReviews={onPressReviews} />
          ) : isTrainee && subline ? (
            <Text
              style={[styles.subline, text.caption, { color: c.textSecondary }]}
              numberOfLines={1}
            >
              {subline}
            </Text>
          ) : null}
        </View>
        {trailing}
      </View>

      {showSearch ? (
        <HomeStickySearchBar
          value={searchValue ?? ""}
          onChangeText={onSearchChange ?? (() => {})}
          onOpenFilters={onOpenFilters}
          activeFilterCount={activeFilterCount}
          embedded
          voiceState={voiceState}
          onVoicePress={onVoicePress}
        />
      ) : null}

      {bottomSlot}

      {categoryChips && categoryChips.length > 0 && onSelectCategory ? (
        <HomeCategoryChipsRow
          items={categoryChips}
          selectedId={selectedCategoryId ?? "__all__"}
          onSelect={(id) => {
            if (id === "__all__") onSelectCategory(null);
            else onSelectCategory(id);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    marginBottom: space.sm,
    paddingBottom: space.xs,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    gap: space.md,
  },
  profileCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  name: {
    fontWeight: "700",
  },
  subline: {
    marginTop: space.xxs,
  },
});
