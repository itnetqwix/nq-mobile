import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { space, useScaledTypography, useThemeColors } from "../../../theme";
import { useCompactA11yGuard } from "../../../lib/layout";
import { useMarketplaceTopPadding } from "./marketplaceLayout";
import { HomeUserAvatar } from "../../dashboard/components/home/HomeUserAvatar";
import {
  HomeCategoryChipsRow,
  type HomeCategoryChip,
} from "../components/HomeCategoryChipsRow";
import { HomeStickySearchBar } from "../components/HomeStickySearchBar";
import type { VoiceInputState } from "../../ai/useVoiceInput";

type Props = {
  /** Blinkit-style top band title (e.g. delivery / welcome). */
  headline: string;
  subline?: string;
  profilePicture?: string;
  profileName: string;
  onPressProfile?: () => void;
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

/**
 * Fixed marketplace header: tinted band + search + category chips (Blinkit-inspired).
 */
export function DiscoverHomeChrome({
  headline,
  subline,
  profilePicture,
  profileName,
  onPressProfile,
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
  const a11y = useCompactA11yGuard();
  const { t } = useAppTranslation();
  const topPadding = useMarketplaceTopPadding(compactTop);

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
        <View style={styles.headlineCol}>
          <Text
            style={[styles.headline, text.titleSm, { color: c.brandNavy, fontWeight: "800" }]}
            numberOfLines={a11y.preferSingleLineTitles ? 1 : 2}
          >
            {headline}
          </Text>
          {subline ? (
            <Text
              style={[styles.subline, text.caption, { color: c.textSecondary }]}
              numberOfLines={a11y.preferSingleLineTitles ? 1 : 2}
            >
              {subline}
            </Text>
          ) : null}
        </View>
        {onPressProfile ? (
          <Pressable
            onPress={onPressProfile}
            accessibilityRole="button"
            accessibilityLabel={t("traineeDiscover.profileA11y")}
          >
            <HomeUserAvatar uri={profilePicture} name={profileName} size={44} />
          </Pressable>
        ) : null}
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
    paddingBottom: space.xs,
    gap: space.sm,
  },
  headlineCol: { flex: 1, minWidth: 0 },
  headline: {},
  subline: {
    marginTop: space.xxs,
  },
});
