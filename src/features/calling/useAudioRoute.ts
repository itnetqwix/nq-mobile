import { useCallback, useEffect, useMemo, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import InCallManager from "react-native-incall-manager";

export type AudioRouteKind =
  | "bluetooth"
  | "speaker"
  | "earpiece"
  | "wired"
  | "unknown";

function normalizeRoute(raw: unknown): AudioRouteKind {
  const s = String(raw ?? "").toLowerCase();
  if (!s) return "unknown";
  if (s.includes("bluetooth")) return "bluetooth";
  if (s.includes("speaker")) return "speaker";
  if (s.includes("earpiece")) return "earpiece";
  if (s.includes("wired") || s.includes("headset") || s.includes("headphone")) return "wired";
  return "unknown";
}

export function useAudioRoute() {
  const [route, setRoute] = useState<AudioRouteKind>("unknown");
  const [hasBluetooth, setHasBluetooth] = useState(false);
  const [hasWired, setHasWired] = useState(false);

  useEffect(() => {
    const onRoute = DeviceEventEmitter.addListener("onAudioRouteChanged", (evt: any) => {
      const next = normalizeRoute(
        evt?.currentRoute ?? evt?.route ?? evt?.output ?? evt?.audioRoute
      );
      setRoute(next);
      const isBt = next === "bluetooth";
      setHasBluetooth(isBt);
      if (isBt) {
        try {
          InCallManager.setForceSpeakerphoneOn(null as any);
          InCallManager.setSpeakerphoneOn(false);
        } catch {
          /* noop */
        }
      }
    });

    const onWired = DeviceEventEmitter.addListener("WiredHeadset", (evt: any) => {
      const plugged = !!(evt?.isPlugged ?? evt?.isPluggedIn ?? evt?.state);
      setHasWired(plugged);
      if (plugged) setRoute("wired");
      else if (route === "wired") setRoute("unknown");
    });

    return () => {
      onRoute.remove();
      onWired.remove();
    };
  }, [route]);

  const routeLabel = useMemo(() => {
    switch (route) {
      case "bluetooth":
        return "Bluetooth";
      case "speaker":
        return "Speaker";
      case "earpiece":
        return "Earpiece";
      case "wired":
        return "Headphones";
      default:
        return "Auto";
    }
  }, [route]);

  const setAudioRoute = useCallback(
    (next: "speaker" | "earpiece" | "bluetooth" | "auto") => {
      try {
        if (next === "speaker") {
          InCallManager.setForceSpeakerphoneOn(true);
          InCallManager.setSpeakerphoneOn(true);
          setRoute("speaker");
          return;
        }

        // "auto" and route-specific non-speaker options should release force speaker.
        InCallManager.setForceSpeakerphoneOn(null as any);
        InCallManager.setSpeakerphoneOn(false);

        if (next === "bluetooth" && hasBluetooth) {
          setRoute("bluetooth");
          return;
        }
        if (next === "earpiece") {
          setRoute("earpiece");
          return;
        }
        setRoute(hasBluetooth ? "bluetooth" : hasWired ? "wired" : "earpiece");
      } catch {
        // no-op
      }
    },
    [hasBluetooth, hasWired]
  );

  const toggleAudioRoute = useCallback(() => {
    const toSpeaker = route !== "speaker";
    try {
      if (toSpeaker) {
        setAudioRoute("speaker");
        return;
      }
      setAudioRoute("auto");
    } catch {
      // no-op
    }
  }, [route, setAudioRoute]);

  return { route, routeLabel, hasBluetooth, hasWired, toggleAudioRoute, setAudioRoute };
}

