import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { reportNetworkError, reportNetworkOk } from "../networkStatusStore";

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
  const apply = (state: NetInfoState) => {
    if (isReachable(state)) reportNetworkOk();
    else reportNetworkError();
  };

  const unsubscribe = NetInfo.addEventListener(apply);
  void NetInfo.fetch().then(apply).catch(() => {});

  return unsubscribe;
}
