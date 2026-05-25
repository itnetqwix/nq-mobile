import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback } from "react";
import type { RootStackParamList } from "../../../navigation/types";
import { setPendingAuthIntent } from "../lib/pendingAuthIntent";
import type { RequireAuthOptions } from "../types/authIntent";
import { useGuestMode } from "./useGuestMode";

type RootNav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Redirects guest users to the Auth modal for protected actions (book, chat, wallet, etc.).
 */
export function useRequireAuth() {
  const isGuest = useGuestMode();
  const navigation = useNavigation<RootNav>();

  const redirectToAuth = useCallback(
    (screen: "Login" | "SignUp" = "Login", options?: RequireAuthOptions) => {
      const opts = options ?? {};
      if (opts.intent || opts.trainer || opts.context) {
        setPendingAuthIntent({
          intent: opts.intent ?? "generic",
          trainer: opts.trainer,
          bookMode: opts.bookMode,
          messageKey: opts.messageKey,
          context: opts.context,
        });
      }
      navigation.navigate("Auth", {
        screen,
        params: {
          intent: opts.intent,
          messageKey: opts.messageKey,
        },
      } as never);
    },
    [navigation]
  );

  const requireAuth = useCallback(
    (onAuthed?: () => void, options?: RequireAuthOptions | string): boolean => {
      if (!isGuest) {
        onAuthed?.();
        return true;
      }
      const resolved: RequireAuthOptions =
        typeof options === "string" ? { messageKey: options } : (options ?? {});
      redirectToAuth(resolved.screen ?? "Login", resolved);
      return false;
    },
    [isGuest, redirectToAuth]
  );

  const openAuth = useCallback(
    (screen: "Login" | "SignUp" = "Login", options?: RequireAuthOptions) => {
      redirectToAuth(screen, options);
    },
    [redirectToAuth]
  );

  return { isGuest, requireAuth, redirectToAuth, openAuth };
}
