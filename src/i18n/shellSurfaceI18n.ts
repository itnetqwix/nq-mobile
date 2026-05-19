import type { TFunction } from "i18next";
import type { ShellSurfaceMeta } from "../features/dashboard/config/shellSurfaces";

const SHELL_KEYS: Record<string, string> = {
  clips: "shell.clips",
  gamePlans: "shell.gamePlans",
  savedLessons: "shell.savedLessons",
  invite: "shell.invite",
  notifications: "shell.notifications",
  settings: "shell.settings",
  wallet: "shell.wallet",
  transactions: "shell.transactions",
  trainerSchedule: "shell.trainerSchedule",
  editProfile: "shell.editProfile",
  reportIssue: "shell.reportIssue",
};

export function localizedShellTitle(t: TFunction, meta: Pick<ShellSurfaceMeta, "id" | "title">): string {
  const key = SHELL_KEYS[meta.id];
  return key ? t(key, { defaultValue: meta.title }) : meta.title;
}
