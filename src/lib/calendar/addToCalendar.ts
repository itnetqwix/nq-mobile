import { Alert, Linking, Platform } from "react-native";
import { DateTime } from "luxon";

export type CalendarEvent = {
  title: string;
  startsAt: string | Date;
  /** Optional explicit end. Defaults to `startsAt + 60min`. */
  endsAt?: string | Date;
  /** Defaults to `startsAt + durationMinutes`. Ignored if `endsAt` is provided. */
  durationMinutes?: number;
  description?: string;
  location?: string;
  /** Defaults to user's device timezone. */
  timeZone?: string;
};

function toUtcCompact(iso: DateTime): string {
  return iso.toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
}

function resolveDates(
  event: CalendarEvent
): { start: DateTime; end: DateTime } | null {
  const tz = event.timeZone || DateTime.local().zoneName || "utc";
  const start = DateTime.fromJSDate(
    typeof event.startsAt === "string" ? new Date(event.startsAt) : event.startsAt
  ).setZone(tz);
  if (!start.isValid) return null;
  const end = event.endsAt
    ? DateTime.fromJSDate(
        typeof event.endsAt === "string" ? new Date(event.endsAt) : event.endsAt
      ).setZone(tz)
    : start.plus({ minutes: event.durationMinutes ?? 60 });
  if (!end.isValid) return null;
  return { start, end };
}

/**
 * Builds a Google Calendar "create event" URL. Works for any device with a
 * browser: it opens in the Google Calendar app if installed and the user is
 * signed in, otherwise falls back to the web event creator. Both iOS and
 * Android handle this gracefully without any extra native module.
 */
export function googleCalendarUrl(event: CalendarEvent): string | null {
  const dates = resolveDates(event);
  if (!dates) return null;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toUtcCompact(dates.start)}/${toUtcCompact(dates.end)}`,
  });
  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);
  if (event.timeZone) params.set("ctz", event.timeZone);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Opens an "add to calendar" target the device understands. We prefer the
 * Google Calendar template URL because it's universal and doesn't require
 * any additional permissions or native modules. iOS users without Google
 * Calendar still get the web flow which can be added to Apple Calendar.
 *
 * Returns true if the OS accepted the URL (best-effort — we have no way to
 * know whether the event was actually saved).
 */
export async function addEventToCalendar(
  event: CalendarEvent
): Promise<boolean> {
  const url = googleCalendarUrl(event);
  if (!url) {
    Alert.alert("Calendar", "Could not build a calendar event.");
    return false;
  }
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert(
        "Calendar",
        Platform.OS === "ios"
          ? "Could not open the calendar. Try installing Google Calendar or Safari."
          : "Could not open the calendar. Try installing Google Calendar."
      );
      return false;
    }
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert("Calendar", "Something went wrong while opening the calendar.");
    return false;
  }
}
