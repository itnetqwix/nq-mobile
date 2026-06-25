import { useEffect, useRef } from "react";

import { getSafeNetInfo } from "../../lib/network/netInfoBootstrap";
import { isNetworkOnline, useNetworkOnline } from "../../lib/networkStatusStore";
import { flushScreenshotUploadQueue } from "./screenshotUploadQueue";

type FlushOptions = {
  sessionId?: string;
  onUploaded?: (imageKey: string) => void;
};

type NetInfoState = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
};

function isConnectedState(state: NetInfoState): boolean {
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

/**
 * Retry queued screenshot uploads when connectivity returns (NetInfo + axios store).
 */
export function useScreenshotUploadRetry(
  enabled: boolean,
  options: FlushOptions
): void {
  const online = useNetworkOnline();
  const wasOfflineRef = useRef(!isNetworkOnline());
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const flush = () => {
    void flushScreenshotUploadQueue({
      sessionId: optionsRef.current.sessionId,
      onUploaded: optionsRef.current.onUploaded,
    });
  };

  useEffect(() => {
    if (!enabled) return;
    flush();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (online) {
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        flush();
      }
    } else {
      wasOfflineRef.current = true;
    }
  }, [enabled, online]);

  useEffect(() => {
    if (!enabled) return;
    const NetInfo = getSafeNetInfo();
    if (!NetInfo) return;
    const unsub = NetInfo.addEventListener((state) => {
      if (isConnectedState(state)) {
        flush();
      }
    });
    return () => unsub();
  }, [enabled]);
}
