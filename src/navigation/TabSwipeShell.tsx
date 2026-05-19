import { DrawerActions, useNavigation, useNavigationState } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import React, { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import type { MainTabParamList } from "./types";

const TAB_ORDER: (keyof MainTabParamList)[] = ["Home", "Schedule", "Chats"];
const SWIPE_THRESHOLD = 56;

type Props = {
  tabIndex: number;
  children: React.ReactNode;
};

function useHomeStackAtRoot(): boolean {
  return useNavigationState((state) => {
    const homeRoute = state.routes.find((r) => r.name === "Home");
    if (!homeRoute?.state) return true;
    const stack = homeRoute.state as { index?: number };
    return (stack.index ?? 0) === 0;
  });
}

/** Horizontal swipe between main tabs; on Dashboard root, swipe right opens the drawer. */
export function TabSwipeShell({ tabIndex, children }: Props) {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const homeAtRoot = useHomeStackAtRoot();

  const swipeEnabled = tabIndex !== 0 || homeAtRoot;

  const goNext = useCallback(() => {
    const next = TAB_ORDER[tabIndex + 1];
    if (next === "Home") {
      navigation.navigate("Home", { screen: "DashboardHome" });
    } else if (next === "Schedule") {
      navigation.navigate("Schedule");
    } else if (next === "Chats") {
      navigation.navigate("Chats");
    }
  }, [navigation, tabIndex]);

  const goPrevOrDrawer = useCallback(() => {
    if (tabIndex === 0 && homeAtRoot) {
      navigation.dispatch(DrawerActions.openDrawer());
      return;
    }
    const prev = TAB_ORDER[tabIndex - 1];
    if (prev === "Home") {
      navigation.navigate("Home", { screen: "DashboardHome" });
    } else if (prev === "Schedule") {
      navigation.navigate("Schedule");
    }
  }, [navigation, tabIndex, homeAtRoot]);

  const gesture = useMemo(() => {
    return Gesture.Pan()
      .enabled(swipeEnabled)
      .activeOffsetX([-28, 28])
      .failOffsetY([-18, 18])
      .onEnd((e) => {
        if (e.translationX <= -SWIPE_THRESHOLD) {
          runOnJS(goNext)();
        } else if (e.translationX >= SWIPE_THRESHOLD) {
          runOnJS(goPrevOrDrawer)();
        }
      });
  }, [swipeEnabled, goNext, goPrevOrDrawer]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.fill}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
