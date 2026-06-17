import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Skeleton } from "../../../components/ui";
import { AccountType, type AccountTypeValue } from "../../../constants/accountType";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { queryKeys } from "../../../lib/queryKeys";
import { useCompactA11yGuard } from "../../../lib/layout";
import { radii, space, useScaledTypography, useThemeColors, useThemedStyles } from "../../../theme";
import { fetchMyTrainerStats } from "../../home/api/homeApi";
import { HomeUserAvatar } from "../../dashboard/components/home/HomeUserAvatar";
import { TrainerOnlineToggle } from "../../dashboard/components/TrainerOnlineToggle";
import {
  HomeCategoryChipsRow,
  type HomeCategoryChip,
} from "../components/HomeCategoryChipsRow";
import { HomeStickySearchBar } from "../components/HomeStickySearchBar";
import type { VoiceInputState } from "../../ai/useVoiceInput";
import { useMarketplaceTopPadding } from "./marketplaceLayout";
import { PublicSocialLinksRow } from "../../../components/social/PublicSocialLinksRow";
import { hasPublicSocialLinks, getSocialLinksFromUser } from "../../../lib/social/socialLinks";
const PROFILE_AVATAR_SIZE = 80;

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
  compactTop?: boolean;
  showSearch?: boolean;
  trailing?: React.ReactNode;
  walletBalanceLabel?: string;
  onOpenWallet?: () => void;
  voiceState?: VoiceInputState;
  onVoicePress?: () => void;
  showAsOnline?: boolean;
  onAvailabilityToggle?: (next: boolean) => Promise<void>;
};

function formatHourlyRate(user: Record<string, unknown> | null | undefined): string | null {
  if (!user) return null;
  const extra = user.extraInfo;
  let raw: unknown = user.hourly_rate;
  if (extra && typeof extra === "object") {
    const rate = (extra as Record<string, unknown>).hourly_rate;
    if (rate != null && rate !== "") raw = rate;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2);
}

function RoleBadge({ label }: { label: string }) {
  const c = useThemeColors();
  const text = useScaledTypography();
  return (
    <View style={[badgeStyles.chip, { backgroundColor: c.brandSubtle, borderColor: c.border }]}>
      <Text style={[badgeStyles.text, text.caption, { color: c.brandNavy }]}>{label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginBottom: 6,
  },
  text: { fontWeight: "700", fontSize: 11, letterSpacing: 0.2 },
});

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
  const styles = useMetaStyles();
  const hourly = formatHourlyRate(user);

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
      <View style={styles.row}>
        <Skeleton width={140} height={36} radius={radii.pill} />
        <Skeleton width={72} height={36} radius={radii.pill} />
      </View>
    );
  }

  const ratingBody = (
    <>
      <Ionicons name="star" size={15} color={c.warning} />
      <Text style={[styles.ratingValue, text.caption, { color: c.text }]}>
        {hasRating ? avg!.toFixed(1) : "—"}
      </Text>
      <Text style={[styles.ratingMeta, text.caption, { color: c.textMuted }]} numberOfLines={1}>
        {count > 0
          ? t("traineeDiscover.reviewCount", { count })
          : t("trainerDashboard.noReviewsYet")}
      </Text>
      {onPressReviews ? (
        <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
      ) : null}
    </>
  );

  return (
    <View style={styles.row}>
      {onPressReviews ? (
        <Pressable
          onPress={onPressReviews}
          style={({ pressed }) => [styles.pill, styles.ratingPill, pressed && { opacity: 0.88 }]}
          accessibilityRole="button"
          accessibilityLabel={
            hasRating
              ? t("trainerDashboard.openReviewsA11y", {
                  rating: avg!.toFixed(1),
                  count,
                })
              : t("trainerDashboard.noReviewsYet")
          }
        >
          {ratingBody}
        </Pressable>
      ) : (
        <View style={[styles.pill, styles.ratingPill]}>{ratingBody}</View>
      )}
      {hourly ? (
        <View style={[styles.pill, styles.ratePill, { borderColor: c.border }]}>
          <Ionicons name="cash-outline" size={14} color={c.brandNavy} />
          <Text style={[styles.rateValue, text.caption, { color: c.brandNavy }]}>
            {t("discoverHome.sessionRate", { rate: hourly, defaultValue: "${{rate}}/hr" })}
          </Text>
        </View>
      ) : (
        <View style={[styles.pill, styles.ratePillMuted, { borderColor: c.border }]}>
          <Text style={[styles.rateHint, text.caption, { color: c.textMuted }]}>
            {t("discoverHome.setHourlyRate", { defaultValue: "Set your hourly rate" })}
          </Text>
        </View>
      )}
    </View>
  );
}

function TraineeProfileMeta({
  subline,
  walletBalanceLabel,
  onOpenWallet,
}: {
  subline?: string;
  walletBalanceLabel?: string;
  onOpenWallet?: () => void;
}) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const text = useScaledTypography();
  const styles = useMetaStyles();

  return (
    <View style={styles.row}>
      {subline ? (
        <View style={[styles.pill, styles.sublinePill, { borderColor: c.border }]}>
          <Text style={[styles.sublineText, text.caption, { color: c.textSecondary }]} numberOfLines={1}>
            {subline}
          </Text>
        </View>
      ) : null}
      {walletBalanceLabel && onOpenWallet ? (
        <Pressable
          onPress={onOpenWallet}
          style={({ pressed }) => [styles.pill, styles.walletPill, pressed && { opacity: 0.88 }]}
          accessibilityRole="button"
          accessibilityLabel={t("traineeDiscover.walletA11y")}
        >
          <Ionicons name="wallet-outline" size={14} color={c.brandNavy} />
          <Text style={[styles.walletValue, text.caption, { color: c.text }]} numberOfLines={1}>
            {walletBalanceLabel}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function useMetaStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      row: {
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: space.xs,
        marginTop: 4,
      },
      pill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: radii.pill,
        borderWidth: 1,
        maxWidth: "100%",
      },
      ratingPill: {
        backgroundColor: palette.surfaceMuted,
        borderColor: palette.borderSubtle,
        flexShrink: 1,
      },
      ratePill: {
        backgroundColor: palette.brandSubtle,
      },
      ratePillMuted: {
        backgroundColor: palette.surfaceElevated,
      },
      rateValue: { fontWeight: "800" },
      rateHint: { fontWeight: "600" },
      ratingValue: { fontWeight: "800" },
      ratingMeta: { fontWeight: "500", flexShrink: 1 },
      sublinePill: {
        backgroundColor: palette.surfaceElevated,
        flexShrink: 1,
      },
      sublineText: { fontWeight: "600" },
      walletPill: {
        backgroundColor: palette.surfaceElevated,
        borderColor: palette.border,
      },
      walletValue: { fontWeight: "700", flexShrink: 1 },
    })
  );
}

/**
 * Marketplace header: profile band + search + category chips (scrolls with feed).
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
  walletBalanceLabel,
  onOpenWallet,
  voiceState,
  onVoicePress,
  showAsOnline,
  onAvailabilityToggle,
}: Props) {
  const c = useThemeColors();
  const text = useScaledTypography();
  useCompactA11yGuard();
  const { t } = useAppTranslation();
  const topPadding = useMarketplaceTopPadding(compactTop);

  const isTrainer = role === AccountType.TRAINER || role === "trainer";

  const displayName = profileName?.trim() || t("dashboardHome.userDefault", { defaultValue: "Member" });
  const roleLabel = isTrainer
    ? t("trainerDashboard.roleTrainer")
    : t("traineeDiscover.roleTrainee");
  const socialLinks = user ? getSocialLinksFromUser(user) : null;
  const showSocialLinks = !!socialLinks && hasPublicSocialLinks(socialLinks);

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

  const trainerTopRight = isTrainer ? (
    <View style={styles.trainerTopRight}>
      {onAvailabilityToggle != null ? (
        <View style={[styles.onlineWrap, { borderColor: c.border, backgroundColor: c.surfaceElevated }]}>
          <TrainerOnlineToggle
            compact
            value={showAsOnline ?? false}
            onToggle={onAvailabilityToggle}
          />
        </View>
      ) : null}
      {showSocialLinks ? (
        <PublicSocialLinksRow user={user} size="sm" align="right" />
      ) : null}
    </View>
  ) : null;

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
      {isTrainer ? (
        <View
          style={[
            styles.trainerCard,
            {
              borderColor: c.border,
              backgroundColor: c.surfaceElevated,
            },
          ]}
        >
          <View style={styles.trainerHeaderRow}>
            <View style={styles.trainerIdentity}>
              {avatar}
              <View style={styles.trainerIdentityText}>
                <Text style={[styles.name, text.titleMd, { color: c.text }]} numberOfLines={2}>
                  {displayName}
                </Text>
                <RoleBadge label={roleLabel} />
              </View>
            </View>
            {trainerTopRight}
          </View>
          <TrainerProfileMeta user={user} onPressReviews={onPressReviews} />
        </View>
      ) : (
        <View style={styles.topRow}>
          {avatar}
          <View style={styles.profileCol}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, text.titleMd, { color: c.text }]} numberOfLines={1}>
                {displayName}
              </Text>
              {trailing}
            </View>
            <RoleBadge label={roleLabel} />
            <TraineeProfileMeta
              subline={subline}
              walletBalanceLabel={walletBalanceLabel}
              onOpenWallet={onOpenWallet}
            />
            {showSocialLinks ? (
              <View style={styles.socialRow}>
                <PublicSocialLinksRow user={user} size="sm" />
              </View>
            ) : null}
          </View>
        </View>
      )}

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
  trainerCard: {
    marginHorizontal: space.md,
    marginBottom: space.sm,
    padding: space.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: space.xs,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  trainerHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.sm,
  },
  trainerIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    minWidth: 0,
  },
  trainerIdentityText: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    paddingTop: space.xxs,
  },
  trainerTopRight: {
    alignItems: "flex-end",
    gap: space.xs,
    flexShrink: 0,
    maxWidth: "42%",
  },
  onlineWrap: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    gap: space.md,
  },
  profileCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    paddingTop: space.xxs,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minWidth: 0,
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  socialRow: {
    marginTop: space.xs,
  },
});
