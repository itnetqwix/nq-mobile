import * as SecureStore from "expo-secure-store";
import type { VerificationGateState } from "./hooks/useTrainerVerificationGate";

const CACHE_KEY = "nq.verification.gate.v1";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

type CachedVerificationGate = VerificationGateState & {
  userId: string;
  cachedAt: number;
};

export async function readVerificationGateCache(
  userId: string
): Promise<VerificationGateState | null> {
  if (!userId) return null;
  try {
    const raw = await SecureStore.getItemAsync(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedVerificationGate;
    if (parsed.userId !== userId) return null;
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return {
      loading: false,
      required: parsed.required,
      inGracePeriod: parsed.inGracePeriod,
      graceDaysRemaining: parsed.graceDaysRemaining,
    };
  } catch {
    return null;
  }
}

export async function writeVerificationGateCache(
  userId: string,
  gate: VerificationGateState
): Promise<void> {
  if (!userId) return;
  const payload: CachedVerificationGate = {
    userId,
    cachedAt: Date.now(),
    loading: false,
    required: gate.required,
    inGracePeriod: gate.inGracePeriod,
    graceDaysRemaining: gate.graceDaysRemaining,
  };
  try {
    await SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* non-blocking */
  }
}
