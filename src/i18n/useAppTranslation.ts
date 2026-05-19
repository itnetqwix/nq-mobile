import { useTranslation } from "react-i18next";

/** App-wide i18n hook — use instead of importing `useTranslation` directly. */
export function useAppTranslation() {
  return useTranslation();
}
