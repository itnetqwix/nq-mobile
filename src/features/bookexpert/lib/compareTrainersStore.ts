import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import {
  getTrainerAvgRating,
  getTrainerCompletedSessionCount,
  getTrainerHourlyRate,
  getTrainerId,
  getTrainerName,
  getTrainerReviewCount,
} from "./trainerUtils";

export const MAX_COMPARE_TRAINERS = 3;
const STORAGE_KEY = "nq.compare.trainers.v1";

export type CompareTrainerRow = {
  _id: string;
  name: string;
  profile_picture?: string;
  hourly_rate?: number;
  avgRating?: number;
  reviewCount?: number;
  completedSessions?: number;
  languages?: string[];
  categories?: string[];
  is_online?: boolean;
  raw: Record<string, unknown>;
};

let state: CompareTrainerRow[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): CompareTrainerRow[] {
  return state;
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string");
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function buildRow(trainer: Record<string, unknown>, id: string): CompareTrainerRow {
  const extra = trainer.extraInfo as Record<string, unknown> | undefined;
  return {
    _id: id,
    name: getTrainerName(trainer) || "Coach",
    profile_picture:
      (trainer.profile_picture as string | undefined) ??
      (trainer.avatar as string | undefined),
    hourly_rate: getTrainerHourlyRate(trainer) ?? undefined,
    avgRating: getTrainerAvgRating(trainer) ?? undefined,
    reviewCount: getTrainerReviewCount(trainer),
    completedSessions: getTrainerCompletedSessionCount(trainer),
    languages: asArray(extra?.languages ?? trainer.languages),
    categories: asArray(trainer.category ?? trainer.categories),
    is_online: Boolean((trainer as { is_online?: boolean }).is_online),
    raw: trainer,
  };
}

async function persist(): Promise<void> {
  try {
    const payload = state.map((row) => row.raw);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* best effort */
  }
}

export async function hydrateCompareTrainersStore(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const list = JSON.parse(raw) as Record<string, unknown>[];
    if (!Array.isArray(list)) return;
    state = list
      .map((trainer) => {
        const id = getTrainerId(trainer);
        return id ? buildRow(trainer, id) : null;
      })
      .filter((row): row is CompareTrainerRow => row !== null)
      .slice(0, MAX_COMPARE_TRAINERS);
    emit();
  } catch {
    state = [];
  }
}

/**
 * Compare-trainers tray. Persisted locally so a short app restart does not
 * drop the user's comparison list while browsing coaches.
 */
export const compareTrainersStore = {
  subscribe,
  getSnapshot,

  isPinned(trainerId: string): boolean {
    return state.some((row) => row._id === trainerId);
  },

  toggle(trainer: Record<string, unknown> | null | undefined): {
    pinned: boolean;
    full: boolean;
  } {
    if (!trainer) return { pinned: false, full: false };
    const id = getTrainerId(trainer);
    if (!id) return { pinned: false, full: false };

    const existing = state.some((row) => row._id === id);
    if (existing) {
      state = state.filter((row) => row._id !== id);
      emit();
      void persist();
      return { pinned: false, full: false };
    }

    if (state.length >= MAX_COMPARE_TRAINERS) {
      return { pinned: false, full: true };
    }

    state = [...state, buildRow(trainer, id)];
    emit();
    void persist();
    return { pinned: true, full: false };
  },

  remove(trainerId: string): void {
    if (!state.some((row) => row._id === trainerId)) return;
    state = state.filter((row) => row._id !== trainerId);
    emit();
    void persist();
  },

  clear(): void {
    if (state.length === 0) return;
    state = [];
    emit();
    void persist();
  },
};

export function useCompareTrainers(): CompareTrainerRow[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
