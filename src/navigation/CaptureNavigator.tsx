import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { CaptureScreen } from "../features/capture/screens/CaptureScreen";
import { CapturedLibraryScreen } from "../features/capture/screens/CapturedLibraryScreen";

type CaptureStackParamList = {
  CapturedLibrary: undefined;
  CaptureCamera: undefined;
};

const Stack = createNativeStackNavigator<CaptureStackParamList>();

/** Library-first capture flow — record from the camera FAB on the library screen. */
export function CaptureNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="CapturedLibrary"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="CapturedLibrary" component={CapturedLibraryScreen} />
      <Stack.Screen name="CaptureCamera" component={CaptureScreen} />
    </Stack.Navigator>
  );
}
