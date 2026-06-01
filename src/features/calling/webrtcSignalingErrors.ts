/** Benign WebRTC signaling races — do not show these as user-facing call errors. */
export function isBenignWebRtcSignalingError(message: string | null | undefined): boolean {
  const m = String(message ?? "").toLowerCase();
  if (!m) return false;
  return (
    m.includes("setremote") ||
    m.includes("setlocal") ||
    m.includes("remote answer") ||
    m.includes("remote description") ||
    m.includes("called in wrong state") ||
    m.includes("invalidstateerror") ||
    m.includes("have-local-offer") ||
    (m.includes("sdp") && (m.includes("failed") || m.includes("error")))
  );
}
