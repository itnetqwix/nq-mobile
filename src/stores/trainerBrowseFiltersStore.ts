import { create } from "zustand";
import {
  DEFAULT_BROWSE_FILTERS,
  type TrainerBrowseFilters,
} from "../features/bookexpert/lib/trainerBrowseConstants";

type TrainerBrowseFiltersState = {
  filters: TrainerBrowseFilters;
  setFilters: (next: TrainerBrowseFilters) => void;
  patchFilters: (patch: Partial<TrainerBrowseFilters>) => void;
  resetFilters: () => void;
};

/** Ephemeral coach-browse filters — survives navigation within the app session. */
export const useTrainerBrowseFiltersStore = create<TrainerBrowseFiltersState>(
  (set) => ({
    filters: { ...DEFAULT_BROWSE_FILTERS },
    setFilters: (filters) => set({ filters }),
    patchFilters: (patch) =>
      set((state) => ({ filters: { ...state.filters, ...patch } })),
    resetFilters: () => set({ filters: { ...DEFAULT_BROWSE_FILTERS } }),
  })
);
