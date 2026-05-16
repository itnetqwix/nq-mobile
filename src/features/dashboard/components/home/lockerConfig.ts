import { AccountType } from "../../../../constants/accountType";
import type { LockerTileConfig } from "./types";

export const LOCKER_TILES: readonly LockerTileConfig[] = [
  {
    id: "clips",
    title: "Clips",
    subtitle: "Training videos by category",
    icon: "film-outline",
    accent: "navy",
    roles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "gamePlans",
    title: "Game plans",
    subtitle: "Session reports & PDFs",
    icon: "document-text-outline",
    accent: "sky",
    roles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "savedLessons",
    title: "Saved lessons",
    subtitle: "Recordings from your sessions",
    icon: "bookmark-outline",
    accent: "violet",
    roles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
  {
    id: "invite",
    title: "Invite friends",
    subtitle: "Grow your network on NetQwix",
    icon: "mail-outline",
    accent: "amber",
    roles: [AccountType.TRAINER, AccountType.TRAINEE],
  },
] as const;

export function lockerTilesForRole(accountType: string | null): LockerTileConfig[] {
  if (!accountType) return [];
  return LOCKER_TILES.filter((t) =>
    (t.roles as readonly string[]).includes(accountType)
  );
}
