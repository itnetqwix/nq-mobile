import { AccountType } from "../../../constants/accountType";

type MemberLike = {
  account_type?: string;
  accountType?: string;
};

/** Experts use the availability toggle (instant lessons); enthusiasts use live socket presence. */
export function isCommunityTrainer(user: MemberLike | null | undefined): boolean {
  const role = String(user?.account_type ?? user?.accountType ?? "");
  return role === AccountType.TRAINER;
}

export function isCommunityMemberLive(
  userId: string | undefined | null,
  user: MemberLike | null | undefined,
  opts: {
    isTrainerOnline: (id: string) => boolean;
    isSocketOnline: (id: string) => boolean;
  }
): boolean {
  if (!userId) return false;
  const id = String(userId);
  if (isCommunityTrainer(user)) {
    return opts.isTrainerOnline(id);
  }
  return opts.isSocketOnline(id);
}
