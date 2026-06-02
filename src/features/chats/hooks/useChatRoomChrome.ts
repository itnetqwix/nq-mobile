import { useLayoutEffect } from "react";
import { useNavigation } from "@react-navigation/native";

/**
 * Hides the chrome that wraps a full-screen chat room.
 *
 * Two things need to disappear while a chat is open:
 *  1. The header above the current screen (the bottom-tab header on the Chats
 *     tab, or the stack header on a dashboard feature like Community / Friends).
 *  2. The bottom tab bar (so the conversation truly fills the screen).
 *
 * We deliberately only touch the *current* screen's header — restoring
 * `headerShown: true` is only safe on screens that already had a header.
 * Pushing the override any higher used to flip the root stack's `Main`
 * screen on and leak the route name as a title above the chat.
 *
 * For the tab bar we set `tabBarStyle` on the current screen AND its closest
 * parent, because:
 *   - from the Chats tab the current screen *is* the tab screen, so it works
 *     locally,
 *   - from a Home-stack screen (Community, Friends, ArchivedChats) the tab
 *     screen lives one level up, so we need to walk one parent up.
 */
export function useChatRoomChrome(active: boolean) {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    if (!active) return;

    const current: any = navigation;
    const parent: any =
      typeof current?.getParent === "function" ? current.getParent() : null;

    try {
      current.setOptions?.({
        headerShown: false,
        tabBarStyle: { display: "none" },
      });
    } catch {
      /* not all navigators support every option */
    }
    try {
      parent?.setOptions?.({ tabBarStyle: { display: "none" } });
    } catch {
      /* parent might not be a tab navigator */
    }

    return () => {
      try {
        current.setOptions?.({ headerShown: true, tabBarStyle: undefined });
      } catch {
        /* ignore */
      }
      try {
        parent?.setOptions?.({ tabBarStyle: undefined });
      } catch {
        /* ignore */
      }
    };
  }, [active, navigation]);
}
