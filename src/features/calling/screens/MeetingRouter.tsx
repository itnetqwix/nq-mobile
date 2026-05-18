import React, { Suspense } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../../navigation/types";
import { MeetingScreen } from "../../meeting/screens/MeetingScreen";
import { shouldUseNativeMeeting } from "../featureFlag";

type Props = NativeStackScreenProps<RootStackParamList, "Meeting">;

const LazyNativeMeetingScreen = React.lazy(() =>
  import("./NativeMeetingScreen").then((mod) => ({
    default: mod.NativeMeetingScreen,
  }))
);

export function MeetingRouter(props: Props) {
  if (shouldUseNativeMeeting()) {
    return (
      <Suspense fallback={<LoaderFallback />}>
        <LazyNativeMeetingScreen {...props} />
      </Suspense>
    );
  }
  return (
    <View style={styles.legacyWrap}>
      <MeetingScreen {...props} />
      <View style={styles.legacyBanner} pointerEvents="none">
        <Text style={styles.legacyBannerText}>
          Legacy web meeting — enable native calls in settings or rebuild with WebRTC.
        </Text>
      </View>
    </View>
  );
}

function LoaderFallback() {
  return (
    <View style={styles.fallback}>
      <ActivityIndicator size="large" color="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  legacyWrap: { flex: 1 },
  legacyBanner: {
    position: "absolute",
    top: 48,
    left: 12,
    right: 12,
    backgroundColor: "rgba(0,0,128,0.85)",
    padding: 8,
    borderRadius: 8,
  },
  legacyBannerText: { color: "#fff", fontSize: 12, textAlign: "center" },
});
