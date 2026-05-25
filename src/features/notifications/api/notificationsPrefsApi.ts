import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

export type NotificationCategoryId =
  | "messages"
  | "bookings"
  | "payments"
  | "marketing";

export const NOTIFICATION_CATEGORIES: NotificationCategoryId[] = [
  "messages",
  "bookings",
  "payments",
  "marketing",
];

export type ChannelMatrix = Record<
  NotificationCategoryId,
  { push: boolean; email: boolean; sms: boolean }
>;

export type NotificationPreferences = {
  channels: ChannelMatrix;
  mute_until: string | null;
  quiet_hours: {
    enabled: boolean;
    start_minutes: number;
    end_minutes: number;
    timezone: string;
    urgent_categories?: string[];
  };
  bookingReminderCadence?: "standard" | "minimal" | "aggressive" | "off";
};

const DEFAULT_PREFS: NotificationPreferences = {
  channels: {
    messages: { push: true, email: false, sms: false },
    bookings: { push: true, email: true, sms: true },
    payments: { push: true, email: true, sms: false },
    marketing: { push: true, email: true, sms: false },
  },
  mute_until: null,
  quiet_hours: {
    enabled: false,
    start_minutes: 22 * 60,
    end_minutes: 7 * 60,
    timezone: "UTC",
  },
  bookingReminderCadence: "standard",
};

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const res = await apiClient.get(API_ROUTES.notifications.preferences);
    const body = (res.data?.data ?? res.data?.result ?? res.data ?? {}) as Partial<NotificationPreferences>;
    return {
      ...DEFAULT_PREFS,
      ...body,
      channels: { ...DEFAULT_PREFS.channels, ...(body.channels ?? {}) } as ChannelMatrix,
      quiet_hours: { ...DEFAULT_PREFS.quiet_hours, ...(body.quiet_hours ?? {}) },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function updateNotificationPreferences(
  patch: Partial<{
    channels: Partial<ChannelMatrix>;
    bookingReminderCadence: NotificationPreferences["bookingReminderCadence"];
  }>
): Promise<NotificationPreferences> {
  const res = await apiClient.put(API_ROUTES.notifications.preferences, patch);
  const body = (res.data?.data ?? res.data?.result ?? res.data ?? {}) as Partial<NotificationPreferences>;
  return {
    ...DEFAULT_PREFS,
    ...body,
    channels: { ...DEFAULT_PREFS.channels, ...(body.channels ?? {}) } as ChannelMatrix,
    quiet_hours: { ...DEFAULT_PREFS.quiet_hours, ...(body.quiet_hours ?? {}) },
  };
}

export async function setMuteUntil(until: Date | null): Promise<{ mute_until: string | null }> {
  const res = await apiClient.post(API_ROUTES.notifications.mute, {
    until: until ? until.toISOString() : null,
  });
  return (res.data?.data ?? res.data?.result ?? res.data ?? { mute_until: null }) as {
    mute_until: string | null;
  };
}

export async function setQuietHours(value: {
  enabled?: boolean;
  start_minutes?: number;
  end_minutes?: number;
  timezone?: string;
}) {
  const res = await apiClient.post(API_ROUTES.notifications.quietHours, value);
  return (res.data?.data ?? res.data?.result ?? res.data) as NotificationPreferences["quiet_hours"];
}
