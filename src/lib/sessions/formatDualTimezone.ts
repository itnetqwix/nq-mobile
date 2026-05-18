/** Format the same instant in coach TZ and viewer (trainee) TZ for booking UI. */
export function formatDualTimezoneLine(
  isoOrDate: string | Date | undefined | null,
  coachTz: string | undefined,
  viewerTz: string | undefined
): string | null {
  if (!isoOrDate) return null;
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return null;

  const coach = coachTz || "UTC";
  const viewer = viewerTz || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const fmt = (tz: string, prefix: string) => {
    try {
      const label = new Intl.DateTimeFormat(undefined, {
        timeZone: tz,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
      return `${prefix}: ${label}`;
    } catch {
      return null;
    }
  };

  const coachLine = fmt(coach, "Coach");
  const youLine = fmt(viewer, "You");
  if (coachLine && youLine) return `${coachLine} · ${youLine}`;
  return coachLine || youLine;
}
