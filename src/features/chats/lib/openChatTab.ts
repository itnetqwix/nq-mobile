import { CommonActions } from "@react-navigation/native";
import type { ChatTabOpenPayload, MainTabParamList } from "../../../navigation/types";

/**
 * Single entry-point for "open this conversation" from anywhere in the app.
 *
 * Always jumps to the bottom-tab Chats screen (so the active tab is correctly
 * highlighted and the conversation lives inside the Chats stack), and asks
 * `ChatsScreen` to open the given conversation via the `open` route param.
 *
 * `navigation` is intentionally typed as `any` because every caller comes
 * from a different navigator (tabs / stack / drawer composed via
 * `useNavigation()`), and react-navigation's strict `NavigationProp<any>`
 * disallows the (legal) "current screen has no parent state yet" case
 * that `getParent()` walks through here. The function body already
 * defensively probes `getState`, `dispatch`, and `getParent`, so the
 * looser type matches the runtime contract.
 */
export function openChatInTab(
  navigation: any,
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
