import { useCallback, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as FileSystem from "expo-file-system/legacy";
import { putFileToPresignedUrl } from "../../lib/presignedPut";

import { requestScreenshotUpload } from "./meetingReportApi";

type Args = {
  sessionId: string;
  trainerId: string;
  traineeId: string;
  isTrainer: boolean;
  onSaved?: () => void;
};

export function useMeetingScreenshot({
  sessionId,
  trainerId,
  traineeId,
  isTrainer,
  onSaved,
}: Args) {
  const captureTargetRef = useRef<View>(null);
  const [capturing, setCapturing] = useState(false);

  const takeScreenshot = useCallback(async () => {
    if (!isTrainer) return;
    if (!captureTargetRef.current) {
      Alert.alert("Screenshot", "Nothing to capture yet.");
      return;
    }
    setCapturing(true);
    try {
      const uri = await captureRef(captureTargetRef, {
        format: "png",
        quality: 0.92,
        result: "tmpfile",
      });
      const presign = await requestScreenshotUpload({
        sessions: sessionId,
        trainer: trainerId,
        trainee: traineeId,
      });
      const uploadUrl = presign?.data?.url;
      if (!uploadUrl) {
        throw new Error("No upload URL returned");
      }
      await putFileToPresignedUrl(uploadUrl, uri, "image/png");
      await FileSystem.deleteAsync(uri, { idempotent: true });
      onSaved?.();
      Alert.alert("Screenshot saved", "Added to the session game plan.");
    } catch (e: any) {
      Alert.alert("Screenshot failed", e?.message ?? "Could not save screenshot.");
    } finally {
      setCapturing(false);
    }
  }, [isTrainer, onSaved, sessionId, traineeId, trainerId]);

  return { captureTargetRef, takeScreenshot, capturing };
}
