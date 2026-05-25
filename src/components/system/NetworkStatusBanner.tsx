import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkOnline } from "../../lib/networkStatusStore";
import { usePendingChatQueueCount } from "../../features/chats/lib/offlineChatQueue";

/**
 * Slim top-bar banner that shows when the device looks offline. The
 * banner slides in from the top, sits *above* the navigation bar, and
 * automatically disappears the moment the next request succeeds.
 *
 * When we have queued chat messages waiting to flush we also report the
 * count so users know we haven't dropped anything.
 */
export function NetworkStatusBanner() {
  const online = useNetworkOnline();
  const insets = useSafeAreaInsets();
  const pendingCount = usePendingChatQueueCount();
  const translate = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    Animated.spring(translate, {
      toValue: online ? -60 - insets.top : 0,
      useNativeDriver: true,
      damping: 14,
      stiffness: 140,
    }).start();
  }, [online, insets.top, translate]);

  if (online && pendingCount === 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 6,
          transform: [{ translateY: translate }],
        },
      ]}
    >
      <View style={styles.pill}>
        <Ionicons
          name={online ? "cloud-upload-outline" : "cloud-offline-outline"}
          size={14}
          color="#FFFFFF"
        />
        <Text style={styles.text}>
          {!online
            ? pendingCount > 0
              ? `You're offline · ${pendingCount} message${pendingCount === 1 ? "" : "s"} queued`
              : "You're offline — we'll retry automatically"
            : `Reconnected · sending ${pendingCount} queued message${pendingCount === 1 ? "" : "s"}`}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 8,
    alignItems: "center",
    zIndex: 1000,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#111827",
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
});
