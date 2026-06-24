import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { CaptureScreen } from "../features/capture/screens/CaptureScreen";
import { CapturedLibraryScreen } from "../features/capture/screens/CapturedLibraryScreen";
import { CapturedClipUploadScreen } from "../features/capture/screens/CapturedClipUploadScreen";
import type { CaptureShareTarget } from "../features/capture/clipUploadShareTarget";
import type { CapturedClip } from "../features/capture/capturedClipsStorage";
import { nestedStackScreenOptions } from "./stackTransitions";

export type CaptureStackParamList = {
  CapturedLibrary: undefined;
  CaptureCamera: undefined;
  CapturedClipUpload: {
    clips: CapturedClip[];
    shareTarget?: CaptureShareTarget;
    showPrepareStep?: boolean;
    friendIds?: string[];
  };
};

const Stack = createNativeStackNavigator<CaptureStackParamList>();

/** Library-first capture flow — record from the camera FAB on the library screen. */
export function CaptureNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="CapturedLibrary"
      screenOptions={nestedStackScreenOptions()}
    >
      <Stack.Screen name="CapturedLibrary" component={CapturedLibraryScreen} />
      <Stack.Screen name="CaptureCamera" component={CaptureScreen} />
      <Stack.Screen name="CapturedClipUpload" component={CapturedClipUploadScreen} />
    </Stack.Navigator>
  );
}
