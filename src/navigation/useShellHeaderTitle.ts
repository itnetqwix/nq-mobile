import { useLayoutEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { HomeStackParamList } from "./types";

/** Updates the parent Home stack `AppScreenHeader` title (e.g. wallet sub-screens). */
export function useShellHeaderTitle(title: string) {
  const navigation = useNavigation();
  const parent = navigation.getParent<NativeStackNavigationProp<HomeStackParamList>>();

  useLayoutEffect(() => {
    parent?.setOptions({ title });
    return () => {
      if (title !== "Wallet") {
        parent?.setOptions({ title: "Wallet" });
      }
    };
  }, [parent, title]);
}
