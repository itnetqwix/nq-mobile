/**
 * Online/offline for global gates.
 *
 * Offline detection via `expo-network` is disabled until the dev client is
 * rebuilt with that native module (`npx expo run:ios`). Until then we assume
 * online so missing `ExpoNetwork` never crashes or spams the console.
 */
export function useNetworkStatus() {
  return {
    isConnected: true,
    isInternetReachable: true,
    offline: false,
  };
}
