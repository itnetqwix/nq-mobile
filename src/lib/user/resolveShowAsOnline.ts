/** Whether the trainer wants to appear online (default true when unset). */
export function resolveShowAsOnline(user: Record<string, unknown> | null | undefined): boolean {
  if (!user) return true;

  const raw =
    user.showAsOnline ??
    (user as { show_as_online?: unknown }).show_as_online;

  if (raw === true || raw === 1 || raw === "true" || raw === "1") return true;
  if (raw === false || raw === 0 || raw === "false" || raw === "0") return false;

  return true;
}
