import "react-native-gesture-handler";
import { LogBox } from "react-native";
import "react-native-reanimated";
import { registerRootComponent } from "expo";

import App from "./App";

// React 19 warns when a dependency's forwardRef render fn has arity 1 (library issue).
// Harmless in dev; clear Metro cache if it persists after app code fixes.
LogBox.ignoreLogs([
  "forwardRef render functions accept exactly two parameters",
  "VirtualizedLists should never be nested inside plain ScrollViews",
  "Cannot find native module 'ExpoNetwork'",
]);

if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === "string" &&
      (first.includes("forwardRef render functions accept exactly two parameters") ||
        first.includes("VirtualizedLists should never be nested"))
    ) {
      return;
    }
    originalConsoleError(...args);
  };
}

registerRootComponent(App);
