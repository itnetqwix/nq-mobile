import { navigationRef } from "../../navigation/navigationRef";
import type { ShellSurfaceRouteId } from "../../navigation/types";
import type { ChatTabOpenPayload } from "../../navigation/types";

export type NotificationRoute =
  | { kind: "meeting"; lessonId: string }
  | { kind: "feature"; featureId: string }
  | { kind: "shell"; surfaceId: ShellSurfaceRouteId }
  | { kind: "tab"; tab: "Chats" | "Schedule" | "Home" }
  | { kind: "chat"; open: ChatTabOpenPayload };

/**
 * Map push/inbox payload → navigation target. Shared by the notifications
 * screen and `PushNotificationBridge` so taps land in the same place.
 */
export function buildNotificationRoute(item: {
  title?: string;
  bookingInfo?: Record<string, unknown> | null;
  booking_info?: Record<string, unknown> | null;
  data?: Record<string, unknown>;
}): NotificationRoute | null {
  const data = item.data ?? {};
  const kind = String(data.kind ?? "").toLowerCase();
  const title = String(item.title ?? "").toLowerCase();
  const booking = (item.bookingInfo ?? item.booking_info ?? null) as Record<
    string,
    unknown
  > | null;
  const lessonId = String(
    data.lessonId ??
      data.bookingId ??
      data.booking_id ??
      booking?.lessonId ??
      booking?.sessionId ??
      ""
  );

  if (kind === "instant_lesson_request") {
    return { kind: "tab", tab: "Schedule" };
  }

  if (
    kind === "meeting" ||
    kind === "instant_lesson_accept" ||
    kind === "instant_lesson_accepted" ||
    kind === "instant_lesson_join_reminder" ||
    (data.isInstant && data.outcome === "accepted")
  ) {
    if (lessonId) return { kind: "meeting", lessonId };
  }

  if (kind === "game_plan" || kind === "gameplan" || title.includes("game plan")) {
    return { kind: "shell", surfaceId: "gamePlans" };
  }

  if (kind === "chat_message" || kind === "chat") {
    const conversationId = String(data.conversationId ?? "");
    const partnerId = String(data.senderId ?? data.receiverId ?? "");
    if (conversationId && partnerId) {
      return {
        kind: "chat",
        open: {
          conversationId,
          partner: {
            _id: partnerId,
            fullname: String(data.senderName ?? data.partnerName ?? "Chat"),
            profile_picture: data.profilePicture as string | undefined,
          },
        },
      };
    }
    return { kind: "tab", tab: "Chats" };
  }

  if (
    title.includes("book") ||
    title.includes("session") ||
    title.includes("confirm") ||
    title.includes("reminder") ||
    title.includes("minute") ||
    title.includes("ended") ||
    title.includes("cancel") ||
    lessonId
  ) {
    return { kind: "feature", featureId: "upcoming-sessions" };
  }
  if (title.includes("friend")) {
    return { kind: "feature", featureId: "friends" };
  }
  if (title.includes("clip") || title.includes("video")) {
    return { kind: "shell", surfaceId: "clips" };
  }
  if (title.includes("plan")) {
    return { kind: "shell", surfaceId: "gamePlans" };
  }
  if (title.includes("payment") || title.includes("transaction")) {
    return { kind: "shell", surfaceId: "transactions" };
  }
  if (title.includes("message") || title.includes("chat")) {
    return { kind: "tab", tab: "Chats" };
  }
  return null;
}

export function navigateNotificationRoute(route: NotificationRoute): boolean {
  if (!navigationRef.isReady()) return false;
  try {
    switch (route.kind) {
      case "meeting":
        navigationRef.navigate("Meeting", { lessonId: route.lessonId });
        return true;
      case "feature":
        (navigationRef as any).navigate("Main", {
          screen: "Tabs",
          params: {
            screen: "Home",
            params: {
              screen: "DashboardFeature",
              params: { featureId: route.featureId },
            },
          },
        });
        return true;
      case "shell":
        (navigationRef as any).navigate("Main", {
          screen: "Tabs",
          params: {
            screen: "Home",
            params: {
              screen: "ShellSurface",
              params: { surfaceId: route.surfaceId },
            },
          },
        });
        return true;
      case "tab":
        (navigationRef as any).navigate("Main", {
          screen: "Tabs",
          params: { screen: route.tab },
        });
        return true;
      case "chat":
        (navigationRef as any).navigate("Main", {
          screen: "Tabs",
          params: {
            screen: "Chats",
            params: { open: route.open },
          },
        });
        return true;
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/** Push tap handler — uses `data` + title from the notification payload. */
export function routePushNotificationTap(
  title: string,
  data: Record<string, unknown>
): boolean {
  const kind = String(data.kind ?? "").toLowerCase();
  const lessonId = String(
    data.lessonId ?? data.bookingId ?? data.booking_id ?? ""
  );

  if (kind === "instant_lesson_request") {
    return navigateNotificationRoute({ kind: "tab", tab: "Schedule" });
  }

  if (
    kind === "meeting" ||
    kind === "instant_lesson_accept" ||
    kind === "instant_lesson_accepted" ||
    kind === "instant_lesson_join_reminder" ||
    (data.isInstant && data.outcome === "accepted")
  ) {
    if (lessonId) {
      return navigateNotificationRoute({ kind: "meeting", lessonId });
    }
  }

  const route = buildNotificationRoute({ title, data, bookingInfo: data });
  if (route) return navigateNotificationRoute(route);

  if (!navigationRef.isReady()) return false;
  (navigationRef as any).navigate("Main", {
    screen: "Tabs",
    params: {
      screen: "Home",
      params: {
        screen: "ShellSurface",
        params: { surfaceId: "notifications" as ShellSurfaceRouteId },
      },
    },
  });
  return true;
}
