/** Client-side session metadata for game plan PDF headers (mirrors backend helper). */

export type GamePlanSessionMetaInput = {
  sessionId?: string;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  durationMinutes?: number | null;
  totalExtendedMinutes?: number;
  isInstant?: boolean;
  timeZone?: string | null;
  clipsReviewedCount?: number;
  trainerName?: string;
  traineeName?: string;
  firstPublishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatClock(d: Date, timeZone?: string | null): string {
  try {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timeZone || undefined,
    });
  } catch {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
}

function formatDate(d: Date, timeZone?: string | null): string {
  try {
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: timeZone || undefined,
    });
  } catch {
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
}

function formatStamp(d: Date, timeZone?: string | null): string {
  try {
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timeZone || undefined,
    });
  } catch {
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
}

export function formatGamePlanSessionHeaderLines(meta: GamePlanSessionMetaInput): string[] {
  const lines: string[] = [];
  const start = toDate(meta.startTime);
  const end = toDate(meta.endTime);
  const tz = meta.timeZone?.trim() || null;

  if (start) {
    const datePart = formatDate(start, tz);
    if (end && end.getTime() > start.getTime()) {
      lines.push(`Session: ${datePart} · ${formatClock(start, tz)}–${formatClock(end, tz)}`);
    } else {
      lines.push(`Session: ${datePart} · ${formatClock(start, tz)}`);
    }
  }

  const coach = meta.trainerName?.trim();
  const trainee = meta.traineeName?.trim();
  if (coach || trainee) {
    const parts = [
      coach ? `Coach: ${coach}` : null,
      trainee ? `Trainee: ${trainee}` : null,
    ].filter(Boolean);
    if (parts.length) lines.push(parts.join(" · "));
  }

  const lessonType = meta.isInstant ? "Instant lesson" : "Scheduled lesson";
  const baseMin = meta.durationMinutes ?? null;
  const extMin = Number(meta.totalExtendedMinutes ?? 0);
  let durationLine = `Type: ${lessonType}`;
  if (baseMin) {
    durationLine += ` · Duration: ${baseMin} min`;
    if (extMin > 0) durationLine += ` (+${extMin} extended)`;
  } else if (extMin > 0) {
    durationLine += ` · Extended: +${extMin} min`;
  }
  lines.push(durationLine);

  const clips = Number(meta.clipsReviewedCount ?? 0);
  if (clips > 0) lines.push(`Clips reviewed: ${clips}`);

  const sid = meta.sessionId ? String(meta.sessionId) : "";
  if (sid.length >= 6) lines.push(`Session ref: …${sid.slice(-6)}`);

  const firstPub = toDate(meta.firstPublishedAt);
  const updated = toDate(meta.updatedAt);
  if (firstPub && updated && updated.getTime() - firstPub.getTime() > 60_000) {
    lines.push(`Updated: ${formatStamp(updated, tz)}`);
  } else if (firstPub) {
    lines.push(`Published: ${formatStamp(firstPub, tz)}`);
  }

  return lines;
}
