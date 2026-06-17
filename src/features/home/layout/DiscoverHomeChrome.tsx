import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Skeleton } from "../../../components/ui";
import { OnlinePulseBorder } from "../../../components/ui/OnlinePulseBorder";
import { AccountType, type AccountTypeValue } from "../../../constants/accountType";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { queryKeys } from "../../../lib/queryKeys";
import { useCompactA11yGuard } from "../../../lib/layout";
import { radii, space, typography, useScaledTypography, useThemeColors, useThemedStyles } from "../../../theme";
import { fetchMyTrainerStats } from "../../home/api/homeApi";
import { HomeUserAvatar } from "../../dashboard/components/home/HomeUserAvatar";
import { TrainerOnlineToggle } from "../../dashboard/components/TrainerOnlineToggle";
import {
  HomeCategoryChipsRow,
  type HomeCategoryChip,
} from "../components/HomeCategoryChipsRow";
import { HomeStickySearchBar } from "../components/HomeStickySearchBar";
import type { VoiceInputState } from "../../ai/useVoiceInput";
import { useMarketplaceHorizontalPad, useMarketplaceTopPadding } from "./marketplaceLayout";
import { PublicSocialLinksRow } from "../../../components/social/PublicSocialLinksRow";
import { hasPublicSocialLinks, getSocialLinksFromUser } from "../../../lib/social/socialLinks";

const AVATAR_SIZE = 72;
const SECTION_GAP = space.md;

type Props = {
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginTop: 4,
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
        <Skeleton width={140} height={38} radius={radii.pill} />
        <Skeleton width={100} height={38} radius={radii.pill} />
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
      {onPressReviews ? <Ionicons name="chevron-forward" size={14} color={c.textMuted} /> : null}
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
              ? t("trainerDashboard.openReviewsA11y", { rating: avg!.toFixed(1), count })
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

  if (!subline && !(walletBalanceLabel && onOpenWallet)) return null;

  return (
    <View style={styles.row}>
      {subline ? (
        <View style={[styles.pill, styles.sublinePill, { borderColor: c.border }]}>
          <Text style={[styles.sublineText, text.caption, { color: c.textSecondary }]} numberOfLines={2}>
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
        alignItems: "stretch",
        gap: space.sm,
        marginTop: space.sm,
      },
      pill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: radii.pill,
        borderWidth: 1,
        minHeight: 38,
      },
      ratingPill: {
        backgroundColor: palette.surfaceMuted,
        borderColor: palette.borderSubtle,
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: "48%",
      },
      ratePill: {
        backgroundColor: palette.brandSubtle,
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: "40%",
      },
      ratePillMuted: {
        backgroundColor: palette.surfaceElevated,
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: "40%",
      },
      rateValue: { fontWeight: "800" },
      rateHint: { fontWeight: "600" },
      ratingValue: { fontWeight: "800" },
      ratingMeta: { fontWeight: "500", flexShrink: 1 },
      sublinePill: {
        backgroundColor: palette.surfaceElevated,
        flexGrow: 1,
        flexShrink: 1,
      },
      sublineText: { fontWeight: "600", flex: 1 },
      walletPill: {
        backgroundColor: palette.surfaceElevated,
        borderColor: palette.border,
        flexGrow: 1,
        flexShrink: 1,
      },
      walletValue: { fontWeight: "700", flexShrink: 1 },
    })
  );
}

function ProfileIdentity({
  avatar,
  name,
  roleLabel,
  trailing,
}: {
  avatar: React.ReactNode;
  name: string;
  roleLabel: string;
  trailing?: React.ReactNode;
}) {
  const c = useThemeColors();
  const text = useScaledTypography();

  return (
    <View style={styles.identityRow}>
      {avatar}
      <View style={styles.identityText}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, text.titleMd, { color: c.text }]} numberOfLines={2}>
            {name}
          </Text>
          {trailing}
        </View>
        <RoleBadge label={roleLabel} />
      </View>
    </View>
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
  useCompactA11yGuard();
  const { t } = useAppTranslation();
  const topPadding = useMarketplaceTopPadding(compactTop);
  // Parent screens typically already apply `md` gutter; we cancel that for full-bleed
  // background, but use a slightly tighter inner pad so the chrome feels less inset.
  const parentPad = useMarketplaceHorizontalPad("md");
  const innerPad = useMarketplaceHorizontalPad("sm");

  const bandLayout = useMemo(
    () => ({
      marginLeft: -parentPad.paddingLeft,
      marginRight: -parentPad.paddingRight,
      paddingLeft: innerPad.paddingLeft,
      paddingRight: innerPad.paddingRight,
    }),
    [innerPad.paddingLeft, innerPad.paddingRight, parentPad.paddingLeft, parentPad.paddingRight]
  );

  const isTrainer = role === AccountType.TRAINER || role === "trainer";
  const displayName = profileName?.trim() || t("dashboardHome.userDefault", { defaultValue: "Member" });
  const roleLabel = isTrainer
    ? t("trainerDashboard.roleTrainer")
    : t("traineeDiscover.roleTrainee");
  const socialLinks = user ? getSocialLinksFromUser(user) : null;
  const showSocialLinks = !!socialLinks && hasPublicSocialLinks(socialLinks);

  const avatarNode = onPressProfile ? (
    <Pressable
      onPress={onPressProfile}
      accessibilityRole="button"
      accessibilityLabel={t("traineeDiscover.profileA11y")}
    >
      <HomeUserAvatar uri={profilePicture} name={displayName} size={AVATAR_SIZE} />
    </Pressable>
  ) : (
    <HomeUserAvatar uri={profilePicture} name={displayName} size={AVATAR_SIZE} />
  );

  const cardSurface = {
    borderColor: c.border,
    backgroundColor: c.surfaceElevated,
  };

  const trainerCard = (
    <View style={[styles.profileCard, cardSurface]}>
      <ProfileIdentity avatar={avatarNode} name={displayName} roleLabel={roleLabel} />

      {onAvailabilityToggle != null ? (
        <View style={[styles.onlineToggleRow, { borderColor: c.border, backgroundColor: c.surface }]}>
          <TrainerOnlineToggle
            compact
            value={showAsOnline ?? false}
            onToggle={onAvailabilityToggle}
          />
        </View>
      ) : null}

      {showAsOnline ? (
        <View style={[styles.onlineBanner, { backgroundColor: c.successSubtle, borderColor: c.success }]}>
          <Ionicons name="radio-outline" size={15} color={c.success} />
          <Text style={[styles.onlineBannerText, { color: c.success }]}>
            {t("trainerDashboard.visibleForInstant", {
              defaultValue: "Visible for instant lessons",
            })}
          </Text>
        </View>
      ) : null}

      <TrainerProfileMeta user={user} onPressReviews={onPressReviews} />

      {showSocialLinks ? (
        <View style={[styles.socialRow, { borderTopColor: c.border }]}>
          <PublicSocialLinksRow user={user} size="sm" align="left" />
        </View>
      ) : null}
    </View>
  );

  const traineeCard = (
    <View style={[styles.profileCard, cardSurface]}>
      <ProfileIdentity
        avatar={avatarNode}
        name={displayName}
        roleLabel={roleLabel}
        trailing={trailing}
      />
      <TraineeProfileMeta
        subline={subline}
        walletBalanceLabel={walletBalanceLabel}
        onOpenWallet={onOpenWallet}
      />
      {showSocialLinks ? (
        <View style={[styles.socialRow, { borderTopColor: c.border }]}>
          <PublicSocialLinksRow user={user} size="sm" align="left" />
        </View>
      ) : null}
    </View>
  );

  return (
    <View
      style={[
        styles.band,
        bandLayout,
        {
          backgroundColor: c.homeMarketplaceBand,
          paddingTop: topPadding,
        },
      ]}
    >
      <View style={styles.contentStack}>
        {isTrainer ? (
          showAsOnline ? (
            <OnlinePulseBorder active borderRadius={radii.xl} style={styles.fullWidth}>
              {trainerCard}
            </OnlinePulseBorder>
          ) : (
            trainerCard
          )
        ) : (
          traineeCard
        )}

        {showSearch ? (
          <View style={styles.searchWrap}>
            <HomeStickySearchBar
              value={searchValue ?? ""}
              onChangeText={onSearchChange ?? (() => {})}
              onOpenFilters={onOpenFilters}
              activeFilterCount={activeFilterCount}
              embedded
              voiceState={voiceState}
              onVoicePress={onVoicePress}
            />
          </View>
        ) : null}
      </View>

      {categoryChips && categoryChips.length > 0 && onSelectCategory ? (
        <View
          style={[
            styles.categoryBleed,
            {
              marginLeft: -parentPad.paddingLeft,
              marginRight: -parentPad.paddingRight,
            },
          ]}
        >
          <HomeCategoryChipsRow
            items={categoryChips}
            selectedId={selectedCategoryId ?? "__all__"}
            onSelect={(id) => {
              if (id === "__all__") onSelectCategory(null);
              else onSelectCategory(id);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    alignSelf: "stretch",
    width: "100%",
    paddingBottom: 0,
  },
  contentStack: {
    gap: SECTION_GAP,
  },
  fullWidth: {
    alignSelf: "stretch",
    width: "100%",
  },
  profileCard: {
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    gap: 0,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    minWidth: 0,
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontWeight: "800",
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  onlineToggleRow: {
    marginTop: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  onlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: space.md,
  },
  onlineBannerText: {
    ...typography.caption,
    fontWeight: "700",
    flex: 1,
    lineHeight: 18,
  },
  socialRow: {
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  searchWrap: {
    marginTop: space.xxs,
  },
  categoryBleed: {
    marginTop: 0,
  },
});
