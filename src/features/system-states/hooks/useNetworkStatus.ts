import { useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

type NetInfoState = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
};

type NetInfoApi = {
  addEventListener: (listener: (state: NetInfoState) => void) => () => void;
  fetch: () => Promise<NetInfoState>;
};

function loadNetInfo(): NetInfoApi | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@react-native-community/netinfo").default;
  } catch {
    return null;
  }
}

/**
 * Online/offline signal for global gates. Uses NetInfo when installed;
 * otherwise assumes connected (API errors still surface offline preset).
 */
export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(
    true
  );

  useEffect(() => {
    const NetInfo = loadNetInfo();
    if (!NetInfo) return;

    const apply = (state: {
      isConnected: boolean | null;
      isInternetReachable: boolean | null;
    }) => {
      setIsConnected(state.isConnected !== false);
      setIsInternetReachable(
        state.isInternetReachable === false ? false : true
      );
    };

    const unsub = NetInfo.addEventListener(apply);
    void NetInfo.fetch().then(apply);

    const onAppState = (next: AppStateStatus) => {
      if (next === "active") void NetInfo.fetch().then(apply);
    };
    const sub = AppState.addEventListener("change", onAppState);

    return () => {
      unsub();
      sub.remove();
    };
  }, []);

  const offline =
    !isConnected || isInternetReachable === false;

  return { isConnected, isInternetReachable, offline };
}
