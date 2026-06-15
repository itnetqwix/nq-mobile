/** Dev-only REST call counter — surfaces API storms in Metro logs. */

type ApiCallEntry = { method: string; url: string; at: number };

const ROLLING_WINDOW_MS = 60_000;
const WARN_PER_MINUTE = 50;
const WARN_BURST_PER_SEC = 10;

let calls: ApiCallEntry[] = [];
let lastBurstWarnAt = 0;

function trim() {
  const cutoff = Date.now() - ROLLING_WINDOW_MS;
  calls = calls.filter((c) => c.at >= cutoff);
}

export function recordApiCall(method: string, url: string): void {
  if (!__DEV__) return;
  const now = Date.now();
  calls.push({ method: method.toUpperCase(), url, at: now });
  trim();

  const lastSecond = calls.filter((c) => c.at >= now - 1_000).length;
  if (lastSecond >= WARN_BURST_PER_SEC && now - lastBurstWarnAt > 5_000) {
    lastBurstWarnAt = now;
    // eslint-disable-next-line no-console
    console.warn(
      `[api-telemetry] burst: ${lastSecond} REST calls in the last second (${calls.length} in 60s)`
    );
  }

  if (calls.length === WARN_PER_MINUTE || calls.length === WARN_PER_MINUTE * 2) {
    // eslint-disable-next-line no-console
    console.warn(
      `[api-telemetry] ${calls.length} REST calls in the last 60s — check invalidation / polling loops`
    );
  }
}

export function getApiCallStats(): { last60s: number; last1s: number } {
  trim();
  const now = Date.now();
  return {
    last60s: calls.length,
    last1s: calls.filter((c) => c.at >= now - 1_000).length,
  };
}

export function resetApiCallTelemetry(): void {
  calls = [];
}
