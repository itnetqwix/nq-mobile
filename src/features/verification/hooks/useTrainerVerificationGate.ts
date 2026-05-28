import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";
import { getVerificationStatus, needsTrainerOnboarding } from "../verificationApi";
import {
  readVerificationGateCache,
  writeVerificationGateCache,
} from "../verificationGateCache";

export type VerificationGateState = {
  loading: boolean;
  /** Hard block — show verification wizard */
  required: boolean;
  /** Legacy 30-day window — full app + optional reminder */
  inGracePeriod: boolean;
  graceDaysRemaining: number;
};

const IDLE: VerificationGateState = {
  loading: false,
  required: false,
  inGracePeriod: false,
  graceDaysRemaining: 0,
};

function resolveUserId(user: Record<string, unknown> | null | undefined): string {
  if (!user) return "";
  const id = user._id ?? user.id;
  return id != null ? String(id) : "";
}

/**
 * Server-driven gate for trainer verification. Uses `/verification/status` so
 * grace period and grandfather rules match the API (not only local user JSON).
 */
export function useTrainerVerificationGate(): VerificationGateState & {
  refetchVerificationGate: () => void;
} {
  const { status: authStatus, user, accountType } = useAuth();
  const [gate, setGate] = useState<VerificationGateState>({ ...IDLE, loading: true });
  const [refetchTick, setRefetchTick] = useState(0);
  const hasResolvedRef = useRef(false);
  const prevUserIdRef = useRef("");
  const userRef = useRef(user);
  userRef.current = user;
  const userId = resolveUserId(user);

  const refetchVerificationGate = useCallback(() => {
    setRefetchTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (authStatus === "loading") {
      hasResolvedRef.current = false;
      setGate({ ...IDLE, loading: true });
      return;
    }

    if (authStatus !== "signedIn") {
      hasResolvedRef.current = false;
      setGate(IDLE);
      return;
    }

    const isTrainer =
      accountType === AccountType.TRAINER ||
      user?.account_type === AccountType.TRAINER;

    if (!isTrainer) {
      hasResolvedRef.current = false;
      setGate(IDLE);
      return;
    }

    if (!userId) {
      setGate({ ...IDLE, loading: true });
      return;
    }

    if (prevUserIdRef.current !== userId) {
      hasResolvedRef.current = false;
      prevUserIdRef.current = userId;
    }

    let cancelled = false;

    const applyGate = (next: VerificationGateState) => {
      if (cancelled) return;
      hasResolvedRef.current = true;
      setGate(next);
      void writeVerificationGateCache(userId, next);
    };

    const run = async () => {
      const blockUI = !hasResolvedRef.current;

      if (blockUI) {
        const cached = await readVerificationGateCache(userId);
        if (cached) {
          applyGate(cached);
        } else {
          setGate({ ...IDLE, loading: true });
        }
      }

      try {
        const s = await getVerificationStatus();
        if (cancelled) return;
        const rejected = s.status === "rejected" || s.step === "rejected";
        const step = String(s.step ?? "").toLowerCase();
        const status = String(s.status ?? "").toLowerCase();
        // Keep trainers in the verification flow while the application is
        // submitted/under review even if the backend marks `required: false`.
        const forceRequiredDuringReview =
          status !== "approved" && (step === "under_review" || step === "completed");
        applyGate({
          loading: false,
          required: rejected ? false : Boolean(s.required || forceRequiredDuringReview),
          inGracePeriod: Boolean(s.in_grace_period),
          graceDaysRemaining: s.grace_days_remaining ?? 0,
        });
      } catch {
        if (cancelled) return;
        const currentUser = userRef.current;
        const onboarding = currentUser?.onboarding as { required?: boolean } | undefined;
        applyGate({
          loading: false,
          required: onboarding?.required ?? needsTrainerOnboarding(currentUser),
          inGracePeriod: false,
          graceDaysRemaining: 0,
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [authStatus, accountType, userId, refetchTick]);

  return { ...gate, refetchVerificationGate };
}
