import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, ListRow, SectionHeader } from "../../../components/ui";
import { radii, space, typography, useThemeColors } from "../../../theme";
import { haptics } from "../../../lib/haptics";
import { queryKeys } from "../../../lib/queryKeys";
import {
  fetchNotificationPreferences,
  NOTIFICATION_CATEGORIES,
  type NotificationCategoryId,
  setMuteUntil,
  setQuietHours,
  updateNotificationPreferences,
} from "../api/notificationsPrefsApi";
import { ensureNotificationPermissions, requestPushPermissionForReason } from "../pushTokens";
import { QuietHoursSheet } from "../components/QuietHoursSheet";
import { MuteForSheet } from "../components/MuteForSheet";

const CATEGORY_META: Record<
  NotificationCategoryId,
  { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  messages: {
    title: "Messages",
    subtitle: "Chat replies and reactions",
    icon: "chatbubble-ellipses-outline",
  },
  bookings: {
    title: "Bookings",
    subtitle: "Confirmations, reminders, cancellations",
    icon: "calendar-outline",
  },
  payments: {
    title: "Payments",
    subtitle: "Top-ups, payouts, refunds",
    icon: "card-outline",
  },
  marketing: {
    title: "Promos & news",
    subtitle: "Offers, NetQwix updates",
    icon: "megaphone-outline",
  },
};

const CHANNELS: { id: "push" | "email" | "sms"; label: string }[] = [
  { id: "push", label: "Push" },
  { id: "email", label: "Email" },
  { id: "sms", label: "SMS" },
];

function formatTimeRange(startMin: number, endMin: number): string {
  const fmt = (m: number) => {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
  };
  return `${fmt(startMin)} – ${fmt(endMin)}`;
}

function formatMuteUntil(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (d.getTime() <= Date.now()) return null;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? `Muted until ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : `Muted until ${d.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}`;
}

export function NotificationPreferencesScreen() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: queryKeys.notifications?.preferences ?? ["notificationPreferences"],
    queryFn: fetchNotificationPreferences,
  });

  const [pushPermStatus, setPushPermStatus] = useState<"granted" | "denied" | "undetermined">(
    "undetermined"
  );
  const [muteSheetOpen, setMuteSheetOpen] = useState(false);
  const [quietSheetOpen, setQuietSheetOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = await ensureNotificationPermissions();
      setPushPermStatus(s);
    })();
  }, []);

  const mutedLabel = useMemo(
    () => formatMuteUntil(prefs?.mute_until ?? null),
    [prefs?.mute_until]
  );

  const handleToggle = async (
    category: NotificationCategoryId,
    channel: "push" | "email" | "sms",
    next: boolean
  ) => {
    haptics.select();
    // Just-in-time push prompt: turning a push channel on requires
    // an OS permission grant if we don't have one yet.
    if (channel === "push" && next && pushPermStatus !== "granted") {
      const ok = await requestPushPermissionForReason(
        category === "messages"
          ? "chat_message"
          : category === "bookings"
          ? "booking_reminder"
          : category === "payments"
          ? "session_starting"
          : "marketing"
      );
      if (!ok) {
        // OS denied; flip nothing.
        setPushPermStatus("denied");
        return;
      }
      setPushPermStatus("granted");
    }
    const previous = prefs?.channels[category];
    queryClient.setQueryData(
      queryKeys.notifications?.preferences ?? ["notificationPreferences"],
      (old: any) => {
        if (!old) return old;
        return {
          ...old,
          channels: {
            ...old.channels,
            [category]: {
              ...old.channels[category],
              [channel]: next,
            },
          },
        };
      }
    );
    try {
      await updateNotificationPreferences({
        channels: {
          [category]: { ...previous, [channel]: next },
        } as any,
      });
    } catch {
      haptics.error();
      queryClient.setQueryData(
        queryKeys.notifications?.preferences ?? ["notificationPreferences"],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            channels: {
              ...old.channels,
              [category]: { ...old.channels[category], [channel]: !next },
            },
          };
        }
      );
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 4, borderBottomColor: c.border }]}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </Pressable>
        <Text style={[typography.titleLg, { color: c.text }]}>Notifications</Text>
        <View style={{ width: 26 }} />
      </View>

      {isLoading || !prefs ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.brandAccent} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: space.md, paddingBottom: insets.bottom + space.xl }}
          showsVerticalScrollIndicator={false}
        >
          {pushPermStatus === "denied" ? (
            <View style={styles.bannerDenied}>
              <Ionicons name="warning-outline" size={18} color="#9A3412" />
              <Text style={styles.bannerDeniedText}>
                Push notifications are blocked in iOS/Android settings. Enable
                them at the OS level to receive pushes.
              </Text>
            </View>
          ) : null}

          <SectionHeader label="Quick actions" />
          <Card variant="outlined" padding={0} style={styles.sectionCard}>
            <ListRow
              icon="moon-outline"
              title={mutedLabel ?? "Mute notifications"}
              subtitle="Pause pushes for 1 hour, 8 hours, until tomorrow morning…"
              onPress={() => setMuteSheetOpen(true)}
              rightAdornment={
                mutedLabel ? (
                  <Pressable
                    hitSlop={8}
                    onPress={async () => {
                      haptics.tap();
                      await setMuteUntil(null);
                      void queryClient.invalidateQueries({
                        queryKey: queryKeys.notifications?.preferences ?? ["notificationPreferences"],
                      });
                    }}
                  >
                    <Text style={styles.unmuteLabel}>Unmute</Text>
                  </Pressable>
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
                )
              }
            />
            <View style={styles.divider} />
            <ListRow
              icon="time-outline"
              title="Quiet hours"
              subtitle={
                prefs.quiet_hours.enabled
                  ? `${formatTimeRange(prefs.quiet_hours.start_minutes, prefs.quiet_hours.end_minutes)} · ${prefs.quiet_hours.timezone}`
                  : "Off"
              }
              onPress={() => setQuietSheetOpen(true)}
              rightAdornment={<Ionicons name="chevron-forward" size={20} color={c.textMuted} />}
            />
          </Card>

          <SectionHeader label="What to notify me about" />
          <Card variant="outlined" padding={0} style={styles.sectionCard}>
            <View style={styles.matrixHeaderRow}>
              <View style={{ flex: 1 }} />
              {CHANNELS.map((ch) => (
                <Text key={ch.id} style={styles.matrixHeaderLabel}>
                  {ch.label}
                </Text>
              ))}
            </View>
            {NOTIFICATION_CATEGORIES.map((cat, idx) => {
              const meta = CATEGORY_META[cat];
              const row = prefs.channels[cat];
              return (
                <View
                  key={cat}
                  style={[
                    styles.matrixRow,
                    idx !== NOTIFICATION_CATEGORIES.length - 1 && styles.matrixRowBorder,
                  ]}
                >
                  <View style={styles.matrixRowLeft}>
                    <View style={[styles.iconBubble, { backgroundColor: c.brandAccentSubtle }]}>
                      <Ionicons name={meta.icon} size={18} color={c.brandAccent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.titleSm, { color: c.text }]}>{meta.title}</Text>
                      <Text style={[typography.bodySm, { color: c.textMuted }]}>{meta.subtitle}</Text>
                    </View>
                  </View>
                  {CHANNELS.map((ch) => (
                    <View key={ch.id} style={styles.matrixCell}>
                      <Switch
                        value={!!row[ch.id]}
                        onValueChange={(v) => void handleToggle(cat, ch.id, v)}
                        trackColor={{ false: c.neutral200, true: c.brandAccentSubtle }}
                        thumbColor={row[ch.id] ? c.brandAccent : c.neutral100}
                      />
                    </View>
                  ))}
                </View>
              );
            })}
          </Card>
        </ScrollView>
      )}

      <MuteForSheet
        visible={muteSheetOpen}
        onClose={() => setMuteSheetOpen(false)}
        onApplied={() => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.notifications?.preferences ?? ["notificationPreferences"],
          });
        }}
      />
      <QuietHoursSheet
        visible={quietSheetOpen}
        initial={prefs?.quiet_hours ?? { enabled: false, start_minutes: 22 * 60, end_minutes: 7 * 60, timezone: "UTC" }}
        onClose={() => setQuietSheetOpen(false)}
        onApplied={() => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.notifications?.preferences ?? ["notificationPreferences"],
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionCard: { marginBottom: space.md, overflow: "hidden" },
  bannerDenied: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: "#FFEDD5",
    marginBottom: space.md,
  },
  bannerDeniedText: {
    flex: 1,
    fontSize: 13,
    color: "#7C2D12",
    lineHeight: 18,
  },
  unmuteLabel: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 13,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#E5E7EB" },
  matrixHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  matrixHeaderLabel: {
    width: 64,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  matrixRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  matrixRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  matrixRowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingRight: 8,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  matrixCell: { width: 64, alignItems: "center" },
});
