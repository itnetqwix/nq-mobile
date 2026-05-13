import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ImageWithSkeleton } from "../../components/ui";
import { getS3ImageUrl } from "../../lib/imageUtils";
import { navigateToNotifications } from "../../navigation/navigationRef";
import { colors, radii, typography } from "../../theme";
import {
  IncomingNotification,
  useNotifications,
} from "./NotificationContext";

const AUTO_DISMISS_MS = 5500;
const TIMER_TINT = colors.info;

/**
 * Floating notification stack. Web parity with
 * `nq-frontend-main/app/components/notification-popup`, but mobile gets a
 * proper queue (max 3) so rapid lifecycle events (booking confirmed + peer
 * joined + 5-min warning) no longer clobber each other.
 *
 * Tapping a row deep-links to the inbox; the close button drops just that
 * entry. Each toast auto-dismisses after `AUTO_DISMISS_MS`.
 */
export function NotificationToast() {
  const insets = useSafeAreaInsets();
  const { toastQueue, dismissToast } = useNotifications();

  if (toastQueue.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + 8, left: 12 + insets.left, right: 12 + insets.right }]}
    >
      {toastQueue.map((toast, idx) => (
        <ToastRow
          key={toast._id ?? `t-${idx}`}
          toast={toast}
          /** Older toasts shrink slightly so the freshest entry pops; the
           *  newest is at the bottom of the stack (idx === length - 1). */
          depth={toastQueue.length - 1 - idx}
          onDismiss={() => dismissToast(toast._id)}
        />
      ))}
    </View>
  );
}

function ToastRow({
  toast,
  depth,
  onDismiss,
}: {
  toast: IncomingNotification;
  depth: number;
  onDismiss: () => void;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(-40)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slide, { toValue: -40, duration: 200, useNativeDriver: true }),
      ]).start(onDismiss);
    }, AUTO_DISMISS_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fade, slide, onDismiss]);

  const senderName = toast.sender?.name ?? "NetQwix";
  const senderAvatar = getS3ImageUrl(toast.sender?.profile_picture ?? "");
  const icon = pickIcon(toast.title);
  const accent = pickAccent(toast.title);

  const handleOpen = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    navigateToNotifications();
    onDismiss();
  };

  /** Older toasts scale down a touch so the newest entry visually leads. */
  const baseScale = depth === 0 ? 1 : 1 - Math.min(0.08, depth * 0.04);

  return (
    <Animated.View
      style={[
        styles.row,
        {
          opacity: fade,
          transform: [{ translateY: slide }, { scale: baseScale }],
        },
      ]}
    >
      <Pressable
        style={[styles.banner, { backgroundColor: accent }]}
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open notification: ${toast.title}`}
      >
        {senderAvatar ? (
          <ImageWithSkeleton
            uri={senderAvatar}
            width={36}
            height={36}
            borderRadius={18}
            style={styles.avatar}
            accessibilityLabel={`${senderName} avatar`}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFb]}>
            <Ionicons name={icon} size={20} color={colors.brandTextOn} />
          </View>
        )}
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {toast.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {toast.description || `From ${senderName}`}
          </Text>
        </View>
        <Pressable
          hitSlop={10}
          onPress={(e) => {
            e.stopPropagation?.();
            if (timerRef.current) clearTimeout(timerRef.current);
            onDismiss();
          }}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
        >
          <Ionicons name="close" size={18} color={colors.brandTextOn} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

function pickIcon(title?: string): keyof typeof Ionicons.glyphMap {
  const t = (title ?? "").toLowerCase();
  if (t.includes("join")) return "person-circle-outline";
  if (t.includes("left")) return "exit-outline";
  if (t.includes("minute") || t.includes("ended") || t.includes("reminder"))
    return "alarm-outline";
  if (t.includes("clip")) return "videocam-outline";
  if (t.includes("book") || t.includes("session")) return "calendar-outline";
  if (t.includes("message") || t.includes("chat")) return "chatbubble-outline";
  if (t.includes("accept") || t.includes("confirm"))
    return "checkmark-circle-outline";
  if (t.includes("cancel") || t.includes("reject")) return "close-circle-outline";
  if (t.includes("payment") || t.includes("transaction")) return "wallet-outline";
  if (t.includes("friend")) return "person-add-outline";
  if (t.includes("report") || t.includes("plan")) return "document-text-outline";
  return "notifications-outline";
}

function pickAccent(title?: string): string {
  const t = (title ?? "").toLowerCase();
  if (t.includes("cancel") || t.includes("reject") || t.includes("declined")) {
    return colors.danger;
  }
  if (t.includes("confirm") || t.includes("accepted") || t.includes("joined")) {
    return colors.success;
  }
  if (t.includes("minute") || t.includes("reminder") || t.includes("warning")) {
    return TIMER_TINT;
  }
  return colors.brandNavy;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    zIndex: 10_001,
    alignItems: "center",
    gap: 8,
  },
  row: { width: "100%" },
  banner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radii.md,
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
  title: { ...typography.subtitle, color: colors.brandTextOn, fontWeight: "800" },
  body: { ...typography.caption, color: "rgba(255,255,255,0.92)", marginTop: 2 },
  closeBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
});
