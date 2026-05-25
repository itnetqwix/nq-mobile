import type { NavigationProp } from "@react-navigation/native";
import { CommonActions } from "@react-navigation/native";
import type { ChatTabOpenPayload, MainTabParamList } from "../../../navigation/types";

/**
 * Single entry-point for "open this conversation" from anywhere in the app.
 *
 * Always jumps to the bottom-tab Chats screen (so the active tab is correctly
 * highlighted and the conversation lives inside the Chats stack), and asks
 * `ChatsScreen` to open the given conversation via the `open` route param.
 */
export function openChatInTab(
  navigation: NavigationProp<any>,
  payload: ChatTabOpenPayload,
): void {
  let cursor: any = navigation;
  while (cursor) {
    try {
      const state = cursor.getState?.();
      const hasChatsRoute =
        Array.isArray(state?.routeNames) && state.routeNames.includes("Chats");
      if (hasChatsRoute) {
        cursor.dispatch(
          CommonActions.navigate({
            name: "Chats" as keyof MainTabParamList,
            params: { open: payload },
          } as never),
        );
        return;
      }
    } catch {
      /* keep walking up */
    }
    cursor = typeof cursor.getParent === "function" ? cursor.getParent() : null;
  }

  // Fallback: just dispatch on the original navigator.
  try {
    navigation.dispatch(
      CommonActions.navigate({
        name: "Chats" as keyof MainTabParamList,
        params: { open: payload },
      } as never),
    );
  } catch {
    /* navigation unavailable */
  }
}
