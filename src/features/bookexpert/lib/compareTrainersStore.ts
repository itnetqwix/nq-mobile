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

/**
 * Compare-trainers tray. Lives in-memory only — the tray is a transient
 * shopping basket while the user is browsing, not a saved-list feature.
 * Closing the app drops it; favorites/saved lists are the durable store.
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
      return { pinned: false, full: false };
    }

    if (state.length >= MAX_COMPARE_TRAINERS) {
      return { pinned: false, full: true };
    }

    state = [...state, buildRow(trainer, id)];
    emit();
    return { pinned: true, full: false };
  },

  remove(trainerId: string): void {
    if (!state.some((row) => row._id === trainerId)) return;
    state = state.filter((row) => row._id !== trainerId);
    emit();
  },

  clear(): void {
    if (state.length === 0) return;
    state = [];
    emit();
  },
};

export function useCompareTrainers(): CompareTrainerRow[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
