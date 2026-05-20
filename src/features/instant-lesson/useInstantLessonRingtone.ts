/**
 * Loops bundled caller-tune (dual-tone ring-ring) for incoming instant-lesson requests.
 */

import { Audio } from "expo-av";
import { useCallback, useEffect, useRef } from "react";

const RING_SOURCE = require("../../../assets/sounds/instant-lesson-ring.wav");

export function useInstantLessonRingtone() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const ringingRef = useRef(false);

  useEffect(() => {
    return () => {
      void (async () => {
        const s = soundRef.current;
        soundRef.current = null;
        ringingRef.current = false;
        if (s) {
          try {
            await s.stopAsync();
            await s.unloadAsync();
          } catch {
            /* ignore */
          }
        }
      })();
    };
  }, []);

  const stopRinging = useCallback(async () => {
    ringingRef.current = false;
    const s = soundRef.current;
    soundRef.current = null;
    if (!s) return;
    try {
      await s.stopAsync();
      await s.unloadAsync();
    } catch {
      /* ignore */
    }
  }, []);

  const startRinging = useCallback(async () => {
    if (ringingRef.current) return;
    ringingRef.current = true;
    try {
      await stopRinging();
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(RING_SOURCE, {
        isLooping: true,
        volume: 0.72,
        shouldPlay: true,
      });
      if (!ringingRef.current) {
        await sound.unloadAsync();
        return;
      }
      soundRef.current = sound;
    } catch {
      ringingRef.current = false;
    }
  }, [stopRinging]);

  return { startRinging, stopRinging };
}
