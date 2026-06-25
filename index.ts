import "react-native-gesture-handler";
import { LogBox } from "react-native";
import "react-native-reanimated";
import { registerRootComponent } from "expo";

import App from "./App";

// React 19 warns when a dependency's forwardRef render fn has arity 1 (library issue).
// Harmless in dev; clear Metro cache if it persists after app code fixes.
LogBox.ignoreLogs([
  "forwardRef render functions accept exactly two parameters",
  "[nq-mobile] forwardRef arity=1",
  "VirtualizedLists should never be nested inside plain ScrollViews",
  "Cannot find native module 'ExpoNetwork'",
  "Failed to get NitroModules",
  "PushNotificationIOS has been extracted",
  "Clipboard has been extracted",
  "SafeAreaView has been deprecated",
  "ProgressBarAndroid has been extracted",
]);

if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const joined = args
      .map((a) => (typeof a === "string" ? a : ""))
      .join(" ");
    if (
      joined.includes("forwardRef render functions accept exactly two parameters") ||
      joined.includes("[nq-mobile] forwardRef arity=1") ||
      joined.includes("VirtualizedLists should never be nested") ||
      joined.includes("Failed to get NitroModules") ||
      (joined.includes("NativeEventEmitter") && joined.includes("non-null argument"))
    ) {
      return;
    }
    const first = args[0];
    if (
      typeof first === "string" &&
      (first.includes("forwardRef render functions accept exactly two parameters") ||
        first.includes("VirtualizedLists should never be nested") ||
        first.includes("Failed to get NitroModules") ||
        (first.includes("NativeEventEmitter") &&
          first.includes("non-null argument")))
    ) {
      return;
    }
    originalConsoleError(...args);
  };
}

registerRootComponent(App);
