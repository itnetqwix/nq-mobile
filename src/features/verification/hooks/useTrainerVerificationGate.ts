import { useEffect, useState } from "react";
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";
import { getVerificationStatus, needsTrainerOnboarding } from "../verificationApi";

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

/**
 * Server-driven gate for trainer verification. Uses `/verification/status` so
 * grace period and grandfather rules match the API (not only local user JSON).
 */
export function useTrainerVerificationGate(): VerificationGateState {
  const { status: authStatus, user, accountType } = useAuth();
  const [gate, setGate] = useState<VerificationGateState>({ ...IDLE, loading: true });

  useEffect(() => {
    if (authStatus === "loading") {
      setGate({ ...IDLE, loading: true });
      return;
    }

    if (authStatus !== "signedIn") {
      setGate(IDLE);
      return;
    }

    const isTrainer =
      accountType === AccountType.TRAINER ||
      user?.account_type === AccountType.TRAINER;

    if (!isTrainer) {
      setGate(IDLE);
      return;
    }

    let cancelled = false;
    setGate((g) => ({ ...g, loading: true }));

    (async () => {
      try {
        const s = await getVerificationStatus();
        if (cancelled) return;
        setGate({
          loading: false,
          required: Boolean(s.required),
          inGracePeriod: Boolean(s.in_grace_period),
          graceDaysRemaining: s.grace_days_remaining ?? 0,
        });
      } catch {
        if (cancelled) return;
        const onboarding = user?.onboarding as { required?: boolean } | undefined;
        setGate({
          loading: false,
          required: onboarding?.required ?? needsTrainerOnboarding(user),
          inGracePeriod: false,
          graceDaysRemaining: 0,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, accountType, user]);

  return gate;
}
