import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { space, typography, useThemeColors } from "../../../theme";
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
  /** Guest uses stack header — less top padding. */
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
  const insets = useSafeAreaInsets();
  const { t } = useAppTranslation();

  return (
    <View
      style={[
        styles.band,
        {
          backgroundColor: c.homeMarketplaceBand,
          paddingTop: compactTop ? space.sm : Math.max(insets.top, space.sm),
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.headlineCol}>
          <Text style={[styles.headline, { color: c.brandNavy }]} numberOfLines={1}>
            {headline}
          </Text>
          {subline ? (
            <Text style={[styles.subline, { color: c.textSecondary }]} numberOfLines={1}>
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
    marginHorizontal: -space.md,
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
  headline: {
    ...typography.titleSm,
    fontWeight: "800",
  },
  subline: {
    ...typography.caption,
    marginTop: 2,
  },
});
