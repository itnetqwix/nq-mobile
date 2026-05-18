/** Match web `LOCAL_STORAGE_KEYS` so tokens align with existing backend expectations. */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: "token",
  ACC_TYPE: "acc_type",
  REFRESH_TOKEN: "refresh_token",
  SESSION_ID: "auth_session_id",
  /** Last chosen app UI language (BCP 47, e.g. en). */
  APP_LOCALE: "app_locale",
} as const;
