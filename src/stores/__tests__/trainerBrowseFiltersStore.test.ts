import { useTrainerBrowseFiltersStore } from "../trainerBrowseFiltersStore";
import { DEFAULT_BROWSE_FILTERS } from "../../features/bookexpert/lib/trainerBrowseConstants";

describe("trainerBrowseFiltersStore", () => {
  beforeEach(() => {
    useTrainerBrowseFiltersStore.getState().resetFilters();
  });

  it("starts from defaults", () => {
    expect(useTrainerBrowseFiltersStore.getState().filters).toEqual(
      DEFAULT_BROWSE_FILTERS
    );
  });

  it("patches partial filter fields", () => {
    useTrainerBrowseFiltersStore.getState().patchFilters({
      selectedCategories: ["tennis"],
    });
    expect(
      useTrainerBrowseFiltersStore.getState().filters.selectedCategories
    ).toEqual(["tennis"]);
  });

  it("replaces filters wholesale", () => {
    const next = {
      ...DEFAULT_BROWSE_FILTERS,
      priceKey: "under100" as const,
      onlineOnly: true,
    };
    useTrainerBrowseFiltersStore.getState().setFilters(next);
    expect(useTrainerBrowseFiltersStore.getState().filters.priceKey).toBe("under100");
    expect(useTrainerBrowseFiltersStore.getState().filters.onlineOnly).toBe(true);
  });
});
