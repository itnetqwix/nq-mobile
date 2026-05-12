import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getS3ImageUrl } from "../../lib/imageUtils";
import { navigateToNotifications } from "../../navigation/navigationRef";
import { useNotifications } from "./NotificationContext";

const NAVY = "#000080";

/** Auto-dismiss the toast after this many milliseconds. */
const AUTO_DISMISS_MS = 5500;

/**
 * Floating banner that surfaces the most recent live notification anywhere in the app —
 * web parity with the popup in `nq-frontend-main/app/components/notification-popup`.
 *
 * Tapping the toast deep-links into the notifications inbox; the user can also explicitly
 * dismiss it. This is decoupled from `InstantLessonStatusBanner` so the two can stack:
 * the instant-lesson banner stays for the lesson lifecycle, while transient
 * notifications (booking confirmed, friend request, etc.) come and go on top.
 */
export function NotificationToast() {
  const insets = useSafeAreaInsets();
  const { latestToast, dismissToast } = useNotifications();

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(-40)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (latestToast) {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(slide, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fade, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(slide, {
            toValue: -40,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => dismissToast());
      }, AUTO_DISMISS_MS);
    } else {
      fade.setValue(0);
      slide.setValue(-40);
    }
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [latestToast, fade, slide, dismissToast]);

  if (!latestToast) return null;

  const senderName = latestToast.sender?.name ?? "NetQwix";
  const senderAvatar = getS3ImageUrl(latestToast.sender?.profile_picture ?? "");
  const icon = pickIcon(latestToast.title);

  const openInbox = () => {
    navigateToNotifications();
    dismissToast();
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { top: insets.top + 8 },
        { opacity: fade, transform: [{ translateY: slide }] },
      ]}
    >
      <Pressable style={styles.banner} onPress={openInbox}>
        {senderAvatar ? (
          <Image source={{ uri: senderAvatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFb]}>
            <Ionicons name={icon} size={20} color="#fff" />
          </View>
        )}
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {latestToast.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {latestToast.description || `From ${senderName}`}
          </Text>
        </View>
        <Pressable hitSlop={10} onPress={dismissToast} style={styles.closeBtn}>
          <Ionicons name="close" size={18} color="#fff" />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

function pickIcon(title?: string): keyof typeof Ionicons.glyphMap {
  const t = (title ?? "").toLowerCase();
  if (t.includes("book") || t.includes("session")) return "calendar-outline";
  if (t.includes("message") || t.includes("chat")) return "chatbubble-outline";
  if (t.includes("accept") || t.includes("confirm")) return "checkmark-circle-outline";
  if (t.includes("cancel") || t.includes("reject")) return "close-circle-outline";
  if (t.includes("payment") || t.includes("transaction")) return "wallet-outline";
  if (t.includes("friend")) return "person-add-outline";
  if (t.includes("report") || t.includes("plan")) return "document-text-outline";
  return "notifications-outline";
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    /** Sit above the instant-lesson banner (zIndex 9999) so urgent notifications win. */
    zIndex: 10_001,
    alignItems: "center",
  },
  banner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: NAVY,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 9,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  avatarFb: { alignItems: "center", justifyContent: "center" },
  text: { flex: 1 },
  title: { color: "#fff", fontSize: 14, fontWeight: "800" },
  body: { color: "rgba(255,255,255,0.92)", fontSize: 12, marginTop: 2, lineHeight: 16 },
  closeBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
});
