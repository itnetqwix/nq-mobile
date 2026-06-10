/**
 * Global avatar cache-bust token.
 * Call `bumpAvatarCacheBust()` after a profile picture upload so all
 * ProfileAvatar / Avatar components that read `getAvatarCacheBust()` will
 * re-fetch the image bypassing the expo-image disk cache.
 */

let _token = 0;
const _listeners = new Set<() => void>();

export function getAvatarCacheBust(): number {
  return _token;
}

export function bumpAvatarCacheBust(): void {
  _token = Date.now();
  _listeners.forEach((fn) => fn());
}

export function subscribeAvatarCacheBust(fn: () => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/** React hook — returns the current token and re-renders when it changes. */
export function useAvatarCacheBust(): number {
  // Inline useState / useEffect to avoid circular deps
  const { useState, useEffect } = require("react") as typeof import("react");
  const [token, setToken] = useState(_token);
  useEffect(() => subscribeAvatarCacheBust(() => setToken(_token)), []);
  return token;
}
