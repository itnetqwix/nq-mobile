import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback } from "react";
import { Alert } from "react-native";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import type { RootStackParamList } from "../../../navigation/types";
import { useGuestMode } from "./useGuestMode";

type RootNav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Prompts guest users to sign in before protected actions (book, chat, wallet, etc.).
 */
export function useRequireAuth() {
  const { t } = useAppTranslation();
  const isGuest = useGuestMode();
  const navigation = useNavigation<RootNav>();

  const openAuth = useCallback(
    (screen: "Login" | "SignUp" = "Login") => {
      navigation.navigate("Auth", { screen } as never);
    },
    [navigation]
  );

  const requireAuth = useCallback(
    (onAuthed?: () => void, messageKey = "guest.signInToContinue"): boolean => {
      if (!isGuest) {
        onAuthed?.();
        return true;
      }
      Alert.alert(t("guest.signInTitle"), t(messageKey), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("auth.signIn"), onPress: () => openAuth("Login") },
        { text: t("auth.signUp"), onPress: () => openAuth("SignUp") },
      ]);
      return false;
    },
    [isGuest, openAuth, t]
  );

  return { isGuest, requireAuth, openAuth };
}
