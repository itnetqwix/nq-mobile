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

  useEffect(() => {
    const onRoute = DeviceEventEmitter.addListener("onAudioRouteChanged", (evt: any) => {
      const next = normalizeRoute(
        evt?.currentRoute ?? evt?.route ?? evt?.output ?? evt?.audioRoute
      );
      setRoute(next);
      setHasBluetooth(next === "bluetooth");
    });

    const onWired = DeviceEventEmitter.addListener("WiredHeadset", (evt: any) => {
      const plugged = !!(evt?.isPlugged ?? evt?.isPluggedIn ?? evt?.state);
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

  const toggleAudioRoute = useCallback(() => {
    const toSpeaker = route !== "speaker";
    try {
      if (toSpeaker) {
        InCallManager.setForceSpeakerphoneOn(true);
        InCallManager.setSpeakerphoneOn(true);
        setRoute("speaker");
        return;
      }
      // Auto route lets the OS pick BT/wired/earpiece.
      InCallManager.setForceSpeakerphoneOn(null as any);
      InCallManager.setSpeakerphoneOn(false);
      setRoute(hasBluetooth ? "bluetooth" : "earpiece");
    } catch {
      // no-op
    }
  }, [route, hasBluetooth]);

  return { route, routeLabel, hasBluetooth, toggleAudioRoute };
}

