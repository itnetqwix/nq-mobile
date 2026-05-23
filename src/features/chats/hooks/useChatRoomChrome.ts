import { useLayoutEffect } from "react";
import { useNavigation } from "@react-navigation/native";

/**
 * Hides tab/stack chrome while a full-screen chat room is open so we do not
 * stack two headers and create dead space at the top.
 */
export function useChatRoomChrome(active: boolean) {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    const tab = navigation.getParent();
    const stack = tab?.getParent?.();

    navigation.setOptions({ headerShown: !active });
    tab?.setOptions({
      headerShown: !active,
      tabBarStyle: active ? { display: "none" } : undefined,
    });
    stack?.setOptions?.({ headerShown: !active });

    return () => {
      navigation.setOptions({ headerShown: true });
      tab?.setOptions({ headerShown: true, tabBarStyle: undefined });
      stack?.setOptions?.({ headerShown: true });
    };
  }, [active, navigation]);
}
