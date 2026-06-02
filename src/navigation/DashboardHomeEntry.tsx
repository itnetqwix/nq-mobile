import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { useAuth } from "../features/auth/context/AuthContext";
import { DashboardHomeScreen } from "../features/dashboard/screens/DashboardHomeScreen";
import { GuestDiscoverHomeScreen } from "../features/dashboard/screens/GuestDiscoverHomeScreen";
import type { HomeStackParamList } from "./types";

type Props = NativeStackScreenProps<HomeStackParamList, "DashboardHome">;

/** Signed-in home vs guest explore (trainer directory without login). */
export function DashboardHomeEntry(props: Props) {
  const { status } = useAuth();
  if (status !== "signedIn") {
    return <GuestDiscoverHomeScreen />;
  }
  return <DashboardHomeScreen {...props} />;
}
