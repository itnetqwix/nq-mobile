import { AccountType } from "../../../constants/accountType";
import { putProfile } from "../../home/api/homeApi";
import type { TrainerCredentialsExtraInfo } from "../types/trainerCredentials";

export function getTrainerExtra(user: Record<string, unknown> | null | undefined): TrainerCredentialsExtraInfo {
  const extra = (user?.extraInfo ?? {}) as TrainerCredentialsExtraInfo;
  return extra ?? {};
}

export function needsTrainerProfileSetup(
  accountType: string | null | undefined,
  user: Record<string, unknown> | null | undefined
): boolean {
  if (accountType !== AccountType.TRAINER || !user) return false;
  const extra = getTrainerExtra(user);
  if (extra.profile_setup_completed_at || extra.profile_setup_skipped_at) return false;
  return true;
}

export async function saveTrainerCredentials(
  user: Record<string, unknown> | null | undefined,
  patch: TrainerCredentialsExtraInfo,
  options?: { completed?: boolean; skipped?: boolean }
): Promise<void> {
  const existing = getTrainerExtra(user);
  const extraInfo: TrainerCredentialsExtraInfo = {
    ...existing,
    ...patch,
    ...(options?.completed
      ? { profile_setup_completed_at: new Date().toISOString() }
      : {}),
    ...(options?.skipped ? { profile_setup_skipped_at: new Date().toISOString() } : {}),
  };
  await putProfile("Trainer", { extraInfo });
}
