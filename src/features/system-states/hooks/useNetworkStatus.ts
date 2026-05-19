import * as Network from "expo-network";
import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

type NetworkSnapshot = {
  isConnected?: boolean;
  isInternetReachable?: boolean;
};

function isOfflineState(state: NetworkSnapshot): boolean {
  if (state.isConnected === false) return true;
  if (state.isInternetReachable === false) return true;
  return false;
}

/**
 * Online/offline for global gates. Uses `expo-network` (Expo module — no separate
 * NetInfo native link). If the module is unavailable, assumes online (API errors
 * can still show the offline preset).
 */
export function useNetworkStatus() {
  const [offline, setOffline] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const monitoringRef = useRef(false);

  useEffect(() => {
    let active = true;
    let subscription: { remove: () => void } | null = null;

    const apply = (state: NetworkSnapshot) => {
      if (!active) return;
      setOffline(isOfflineState(state));
    };

    void (async () => {
      try {
        const initial = await Network.getNetworkStateAsync();
        if (!active) return;
        apply(initial);
        monitoringRef.current = true;
        setMonitoring(true);

        subscription = Network.addNetworkStateListener((event) => {
          apply(event);
        });
      } catch (err) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn(
            "[useNetworkStatus] expo-network unavailable; offline overlay disabled. Rebuild dev client if you added expo-network recently.",
            err
          );
        }
        if (active) {
          setOffline(false);
          monitoringRef.current = false;
          setMonitoring(false);
        }
      }
    })();

    const onAppState = (next: AppStateStatus) => {
      if (next !== "active" || !monitoringRef.current) return;
      void Network.getNetworkStateAsync().then(apply).catch(() => undefined);
    };
    const appSub = AppState.addEventListener("change", onAppState);

    return () => {
      active = false;
      monitoringRef.current = false;
      subscription?.remove();
      appSub.remove();
    };
  }, []);

  const isConnected = !offline;
  return {
    isConnected,
    isInternetReachable: monitoring ? !offline : true,
    offline: monitoring ? offline : false,
  };
}
