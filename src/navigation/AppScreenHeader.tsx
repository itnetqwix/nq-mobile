import type { BottomTabHeaderProps } from "@react-navigation/bottom-tabs";
import type { NativeStackHeaderProps } from "@react-navigation/native-stack";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DrawerMarkButton } from "./DrawerMarkButton";
import {
  APP_HEADER_BAR_HEIGHT,
  APP_HEADER_HORIZONTAL_PADDING,
  APP_HEADER_SIDE_SLOT,
} from "./appHeaderLayout";
import { typography, useThemeColors } from "../theme";

type Props = NativeStackHeaderProps | BottomTabHeaderProps;

function resolveTitle(options: Props["options"]): string {
  if (typeof options.headerTitle === "string") return options.headerTitle;
  if (typeof options.title === "string") return options.title;
  return "NetQwix";
}

/** Balanced top bar: drawer mark (left), centered title, optional headerRight. */
export function AppScreenHeader({ options }: Props) {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const title = resolveTitle(options);
  const HeaderRight = options.headerRight;

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top,
          backgroundColor: c.background,
          borderBottomColor: c.border,
        },
      ]}
    >
      <View style={[styles.bar, { paddingHorizontal: APP_HEADER_HORIZONTAL_PADDING }]}>
        <View style={styles.sideSlot}>
          <DrawerMarkButton />
        </View>
        <View style={styles.titleSlot}>
          <Text style={[styles.title, { color: c.headerTitle }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={[styles.sideSlot, styles.sideSlotRight]}>
          {HeaderRight ? (
            <HeaderRight tintColor={c.headerTint} pressColor={c.headerTint} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    height: APP_HEADER_BAR_HEIGHT,
  },
  sideSlot: {
    minWidth: APP_HEADER_SIDE_SLOT,
    justifyContent: "center",
  },
  sideSlotRight: {
    alignItems: "flex-end",
    flexDirection: "row",
  },
  titleSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  title: {
    ...typography.subtitle,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
});
