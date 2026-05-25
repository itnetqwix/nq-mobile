import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { useAuth } from "../features/auth/context/AuthContext";
import { DashboardHomeScreen } from "../features/dashboard/screens/DashboardHomeScreen";
import { GuestDiscoverHomeScreen } from "../features/dashboard/screens/GuestDiscoverHomeScreen";
import type { HomeStackParamList } from "./types";

type Props = NativeStackScreenProps<HomeStackParamList, "DashboardHome">;

/**
 * Signed-in home vs guest explore (trainer directory without login).
 *
 * The inner `DashboardHomeScreen` declares its props as
 * `CompositeScreenProps<Stack, Tab>` because at runtime it calls
 * `useNavigation()` to jump between the stack and the tab navigator.
 * From this entry's perspective it is *only* mounted as a stack screen,
 * so we use a structural cast — `props as never` would erase the spread
 * shape; instead we widen with `as unknown as` so React still receives a
 * real object with the original `navigation` / `route` it needs.
 */
export function DashboardHomeEntry(props: Props) {
  const { status } = useAuth();
  if (status !== "signedIn") {
    return <GuestDiscoverHomeScreen />;
  }
  const innerProps = props as unknown as React.ComponentProps<typeof DashboardHomeScreen>;
  return <DashboardHomeScreen {...innerProps} />;
}
