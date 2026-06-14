import React, { useMemo } from "react";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ClipUploadModal, type ClipUploadInitialVideo } from "../../dashboard/components/locker/ClipUploadModal";
import {
  shareTargetToWire,
  type CaptureShareTarget,
} from "../clipUploadShareTarget";
import type { CapturedClip } from "../capturedClipsStorage";
import type { CaptureStackParamList } from "../../../navigation/CaptureNavigator";

type UploadRoute = RouteProp<CaptureStackParamList, "CapturedClipUpload">;

function toInitialVideo(clip: CapturedClip): ClipUploadInitialVideo {
  return {
    uri: clip.uri,
    durationSecs: clip.durationSecs,
    fileName: `${(clip.label ?? "capture").replace(/[^\w.-]+/g, "_")}_${clip.id}.mp4`,
    fileSizeBytes: clip.fileSizeBytes,
    mimeType: clip.mimeType ?? "video/mp4",
    title: clip.label,
    captureClipId: clip.id,
  };
}

export function CapturedClipUploadScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CaptureStackParamList>>();
  const route = useRoute<UploadRoute>();
  const { clips, shareTarget = "my-clips", showPrepareStep = true } = route.params;

  const initialVideos = useMemo(() => clips.map(toInitialVideo), [clips]);
  const initialVideo = initialVideos.length === 1 ? initialVideos[0]! : null;
  const wireTarget = shareTargetToWire(shareTarget as CaptureShareTarget);

  return (
    <ClipUploadModal
      visible
      renderAsScreen
      showPrepareStep={showPrepareStep && initialVideos.length === 1}
      initialVideo={initialVideo}
      initialVideos={initialVideos.length > 1 ? initialVideos : []}
      defaultShareTarget={wireTarget}
      captureClipId={initialVideo?.captureClipId ?? null}
      onBack={() => navigation.goBack()}
      onClose={() => navigation.goBack()}
      onUploaded={() => navigation.goBack()}
    />
  );
}
