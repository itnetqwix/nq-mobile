/** IANA timezone for trainee-facing schedules and directory slot previews. */
export function resolveTraineeTimeZone(
  user: Record<string, unknown> | null | undefined
): string {
  const profileTz = user?.time_zone;
  if (typeof profileTz === "string" && profileTz.trim()) return profileTz.trim();
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
