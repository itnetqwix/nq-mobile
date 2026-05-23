import { useLayoutEffect, type DependencyList } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ParamListBase } from "@react-navigation/native";

type StackNav = NativeStackNavigationProp<ParamListBase>;

/**
 * Safely call navigation.setOptions from a child of a screen component
 * (e.g. DashboardHomeEntry) or from the screen itself.
 */
export function useStackScreenOptions(
  apply: (navigation: StackNav) => void,
  deps: DependencyList
) {
  const navigation = useNavigation<StackNav>();

  useLayoutEffect(() => {
    if (typeof navigation?.setOptions !== "function") return;
    apply(navigation);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps
  }, [navigation, ...deps]);
}
