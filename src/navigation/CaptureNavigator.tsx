import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { CaptureScreen } from "../features/capture/screens/CaptureScreen";
import { CapturedLibraryScreen } from "../features/capture/screens/CapturedLibraryScreen";

type CaptureStackParamList = {
  CaptureCamera: undefined;
  CapturedLibrary: undefined;
};

const Stack = createNativeStackNavigator<CaptureStackParamList>();

export function CaptureNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CaptureCamera" component={CaptureScreen} />
      <Stack.Screen name="CapturedLibrary" component={CapturedLibraryScreen} />
    </Stack.Navigator>
  );
}
