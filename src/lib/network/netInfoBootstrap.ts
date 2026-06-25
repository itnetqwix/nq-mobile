import { reportNetworkError, reportNetworkOk } from "../networkStatusStore";

type NetInfoState = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
};

type NetInfoApi = {
  addEventListener: (listener: (state: NetInfoState) => void) => () => void;
  fetch: () => Promise<NetInfoState>;
};

let cachedNetInfo: NetInfoApi | null | undefined;

/** Lazy-load NetInfo so a missing native module never crashes cold start. */
export function getSafeNetInfo(): NetInfoApi | null {
  if (cachedNetInfo !== undefined) return cachedNetInfo;
  try {
    const mod = require("@react-native-community/netinfo");
    const NetInfo = (mod.default ?? mod) as NetInfoApi;
    if (!NetInfo?.addEventListener) {
      cachedNetInfo = null;
      return null;
    }
    cachedNetInfo = NetInfo;
  } catch {
    if (__DEV__) {
      console.warn(
        "[netinfo] Native module unavailable — offline UI uses HTTP errors only. Rebuild: npx expo run:ios --device"
      );
    }
    cachedNetInfo = null;
  }
  return cachedNetInfo;
}

function isReachable(state: NetInfoState): boolean {
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

/**
 * Subscribe to OS network state so offline banners and queues react
 * immediately — not only after the first failed HTTP request.
 */
export function startNetInfoListener(): () => void {
  const NetInfo = getSafeNetInfo();
  if (!NetInfo) return () => {};

  const apply = (state: NetInfoState) => {
    if (isReachable(state)) reportNetworkOk();
    else reportNetworkError();
  };

  try {
    const unsubscribe = NetInfo.addEventListener(apply);
    void NetInfo.fetch().then(apply).catch(() => {});
    return unsubscribe;
  } catch {
    return () => {};
  }
}
