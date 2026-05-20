/** Maps API `refund_reason` codes to i18n keys under `sessions.outcome.*`. */
export const REFUND_REASON_I18N_KEYS: Record<string, string> = {
  accept_expired: "sessions.outcome.acceptExpired",
  join_expired: "sessions.outcome.joinExpired",
  declined: "sessions.outcome.declined",
  no_show: "sessions.outcome.noShow",
  scheduled_trainer_no_show: "sessions.outcome.noShow",
  trainer_cancelled: "sessions.outcome.trainerCancelled",
  trainee_cancelled: "sessions.outcome.traineeCancelled",
};

export function getRefundReasonI18nKey(reason?: string | null): string | null {
  if (!reason) return null;
  const key = String(reason).trim().toLowerCase();
  return REFUND_REASON_I18N_KEYS[key] ?? null;
}
