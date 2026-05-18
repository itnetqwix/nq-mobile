export function trainerIdOf(trainer: Record<string, unknown> | null): string {
  if (!trainer) return "";
  return String(trainer._id ?? trainer.id ?? "");
}

export function trainerNameOf(trainer: Record<string, unknown> | null): string {
  if (!trainer) return "Trainer";
  return String(trainer.fullname ?? trainer.fullName ?? "Trainer");
}

export function getTrainerField(trainer: Record<string, unknown> | null, ...keys: string[]): unknown {
  if (!trainer) return undefined;
  for (const k of keys) {
    if (trainer[k] != null) return trainer[k];
    const ui = trainer.userInfo as Record<string, unknown> | undefined;
    if (ui?.[k] != null) return ui[k];
    const ex = trainer.extraInfo as Record<string, unknown> | undefined;
    if (ex?.[k] != null) return ex[k];
    const uex = ui?.extraInfo as Record<string, unknown> | undefined;
    if (uex?.[k] != null) return uex[k];
  }
  return undefined;
}

export function trainerHourlyRate(trainer: Record<string, unknown> | null): number {
  return Number(getTrainerField(trainer, "hourly_rate") ?? 0);
}
