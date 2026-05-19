import "react-native-gesture-handler";
import { LogBox } from "react-native";
import "react-native-reanimated";
import { registerRootComponent } from "expo";

import App from "./App";

// React 19 warns when a dependency's forwardRef render fn has arity 1 (library issue).
// Harmless in dev; clear Metro cache if it persists after app code fixes.
LogBox.ignoreLogs([
  "forwardRef render functions accept exactly two parameters",
  "Cannot find native module 'ExpoNetwork'",
]);

registerRootComponent(App);
