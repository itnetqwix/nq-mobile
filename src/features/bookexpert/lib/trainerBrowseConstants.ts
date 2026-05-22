export type PriceFilterKey = "any" | "under50" | "under100" | "100to150" | "over150";

export const PRICE_FILTER_OPTIONS: {
  key: PriceFilterKey;
  label: string;
  minHourlyRate?: number;
  maxHourlyRate?: number;
}[] = [
  { key: "any", label: "Any price" },
  { key: "under50", label: "Under $50/hr", maxHourlyRate: 50 },
  { key: "under100", label: "Under $100/hr", maxHourlyRate: 100 },
  { key: "100to150", label: "$100 – $150/hr", minHourlyRate: 100, maxHourlyRate: 150 },
  { key: "over150", label: "$150+/hr", minHourlyRate: 150 },
];

export type RatingFilterKey = "any" | "3" | "4" | "4.5";

export const RATING_FILTER_OPTIONS: {
  key: RatingFilterKey;
  label: string;
  minRating?: number;
}[] = [
  { key: "any", label: "Any rating" },
  { key: "3", label: "3+ stars", minRating: 3 },
  { key: "4", label: "4+ stars", minRating: 4 },
  { key: "4.5", label: "4.5+ stars", minRating: 4.5 },
];

export type TrainerBrowseFilters = {
  selectedCategories: string[];
  priceKey: PriceFilterKey;
  ratingKey: RatingFilterKey;
  onlineOnly: boolean;
  hasOpenSlots: boolean;
  sortBy: "name" | "rating" | "hourly_rate" | "hourly_rate_desc" | "next_available";
};

export const DEFAULT_BROWSE_FILTERS: TrainerBrowseFilters = {
  selectedCategories: [],
  priceKey: "any",
  ratingKey: "any",
  onlineOnly: false,
  hasOpenSlots: false,
  sortBy: "rating",
};

export function countActiveFilters(f: TrainerBrowseFilters): number {
  let n = 0;
  if (f.selectedCategories.length > 0) n += 1;
  if (f.priceKey !== "any") n += 1;
  if (f.ratingKey !== "any") n += 1;
  if (f.onlineOnly) n += 1;
  if (f.hasOpenSlots) n += 1;
  return n;
}

export function filtersToApiParams(f: TrainerBrowseFilters): {
  categories?: string;
  minRating?: number;
  minHourlyRate?: number;
  maxHourlyRate?: number;
  sortBy: TrainerBrowseFilters["sortBy"];
  onlineOnly?: boolean;
  hasSlotsOnly?: boolean;
} {
  const price = PRICE_FILTER_OPTIONS.find((p) => p.key === f.priceKey);
  const rating = RATING_FILTER_OPTIONS.find((r) => r.key === f.ratingKey);
  return {
    categories: f.selectedCategories.length ? f.selectedCategories.join(",") : undefined,
    minRating: rating?.minRating,
    minHourlyRate: price?.minHourlyRate,
    maxHourlyRate: price?.maxHourlyRate,
    sortBy: f.sortBy,
    onlineOnly: f.onlineOnly || undefined,
    hasSlotsOnly: f.hasOpenSlots || undefined,
  };
}
