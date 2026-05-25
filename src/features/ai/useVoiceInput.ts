/**
 * `useVoiceInput` — record a short audio clip from the mic and convert
 * it to text via the AI transcription endpoint.
 *
 * Lifecycle:
 *   `idle` → `recording` → `processing` → `idle` (with transcript)
 *
 * Why an internal state machine?
 *   - The UI button needs to flip between mic / stop / spinner; tracking
 *     `isRecording` + `isTranscribing` separately leads to flicker bugs
 *     when one async settles slightly before the other.
 *
 * Failure modes:
 *   - Permission denied → state returns to `idle`, callback fires with
 *     `error: "permission"`. Caller can show an alert.
 *   - Backend transcribe failure / not implemented → state returns to
 *     `idle`, callback fires with `error: "transcribe"`. Caller can
 *     prompt user to type.
 */

import { Audio } from "expo-av";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";
import { haptics } from "../../lib/haptics";

export type VoiceInputState = "idle" | "recording" | "processing";
export type VoiceInputError = "permission" | "record" | "transcribe";

export type VoiceInputResult = {
  text?: string;
  error?: VoiceInputError;
  message?: string;
};

export type UseVoiceInputOptions = {
  /** Cap recording duration (ms) to avoid runaway recordings. */
  maxDurationMs?: number;
  /** Called whenever a recording resolves. */
  onResult?: (result: VoiceInputResult) => void;
};

export function useVoiceInput(opts: UseVoiceInputOptions = {}) {
  const { maxDurationMs = 30_000, onResult } = opts;
  const [state, setState] = useState<VoiceInputState>("idle");
  const recordingRef = useRef<Audio.Recording | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      const rec = recordingRef.current;
      if (rec) {
        rec.stopAndUnloadAsync().catch(() => undefined);
        recordingRef.current = null;
      }
    };
  }, []);

  const resolve = useCallback(
    (result: VoiceInputResult) => {
      if (!aliveRef.current) return;
      setState("idle");
      onResult?.(result);
    },
    [onResult]
  );

  const start = useCallback(async () => {
    if (state !== "idle") return;
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        haptics.warning();
        resolve({ error: "permission" });
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setState("recording");
      haptics.impact();

      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      autoStopRef.current = setTimeout(() => {
        void stop();
      }, maxDurationMs);
    } catch (e: unknown) {
      haptics.error();
      resolve({
        error: "record",
        message: e instanceof Error ? e.message : "Couldn't start recording",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxDurationMs, resolve, state]);

  const stop = useCallback(async () => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    const rec = recordingRef.current;
    if (!rec) {
      resolve({});
      return;
    }
    setState("processing");
    haptics.tap();
    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = rec.getURI();
      recordingRef.current = null;
      if (!uri) {
        resolve({ error: "record", message: "No audio captured" });
        return;
      }

      const form = new FormData();
      const name = `ai_voice_${Date.now()}.m4a`;
      // @ts-expect-error — RN FormData accepts the { uri, name, type } shape.
      form.append("audio", { uri, name, type: "audio/mp4" });

      try {
        const res = await apiClient.post(API_ROUTES.ai.transcribeInput, form, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 30_000,
        });
        const text: unknown =
          res.data?.result?.text ??
          res.data?.result?.transcript ??
          res.data?.text ??
          res.data?.transcript;
        if (typeof text === "string" && text.trim().length > 0) {
          haptics.success();
          resolve({ text: text.trim() });
        } else {
          haptics.warning();
          resolve({ error: "transcribe", message: "No speech detected" });
        }
      } catch (e: unknown) {
        haptics.warning();
        resolve({
          error: "transcribe",
          message:
            e instanceof Error && e.message
              ? e.message
              : "Transcription service unavailable",
        });
      }
    } catch (e: unknown) {
      recordingRef.current = null;
      haptics.error();
      resolve({
        error: "record",
        message: e instanceof Error ? e.message : "Recording failed",
      });
    }
  }, [resolve]);

  const cancel = useCallback(async () => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    const rec = recordingRef.current;
    if (rec) {
      try {
        await rec.stopAndUnloadAsync();
      } catch {
        /* already stopped */
      }
    }
    recordingRef.current = null;
    setState("idle");
    haptics.warning();
  }, []);

  return { state, start, stop, cancel };
}
