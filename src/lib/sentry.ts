/**
 * Optional Sentry for React Native — set EXPO_PUBLIC_SENTRY_DSN in .env
 */
export function initMobileSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require("@sentry/react-native");
    Sentry.init({
      dsn,
      environment: process.env.EXPO_PUBLIC_APP_ENV || "development",
      tracesSampleRate: 0.1,
    });
  } catch {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[Sentry] Install @sentry/react-native to enable crash reporting");
    }
  }
}
