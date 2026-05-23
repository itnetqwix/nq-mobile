import React from "react";
import { useAuth } from "../features/auth/context/AuthContext";
import { DashboardHomeScreen } from "../features/dashboard/screens/DashboardHomeScreen";
import { GuestDiscoverHomeScreen } from "../features/dashboard/screens/GuestDiscoverHomeScreen";

/** Signed-in home vs guest explore (trainer directory without login). */
export function DashboardHomeEntry() {
  const { status } = useAuth();
  if (status !== "signedIn") {
    return <GuestDiscoverHomeScreen />;
  }
  return <DashboardHomeScreen />;
}
