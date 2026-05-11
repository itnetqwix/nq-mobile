import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { BrandedSessionLoader } from "../components/brand/BrandedSessionLoader";
import { useAuth } from "../features/auth/context/AuthContext";
import { AuthNavigator } from "./AuthNavigator";
import { MainTabs } from "./MainTabs";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Auth vs app shell — same gate as the website (`requiresAuth` on dashboard routes).
 * Successful `signIn` / session restore → `Main` (tabs: locker home, schedule, chats, menu).
 * `signOut` → remount stack to `Auth` (matches hard navigation to `/auth/signIn` on web).
 */
export function RootNavigator() {
  const { status } = useAuth();

  if (status === "loading") {
    return <BrandedSessionLoader />;
  }

  const signedIn = status === "signedIn";

  return (
    <Stack.Navigator
      key={signedIn ? "signedIn" : "signedOut"}
      initialRouteName={signedIn ? "Main" : "Auth"}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Auth" component={AuthNavigator} />
      <Stack.Screen name="Main" component={MainTabs} />
    </Stack.Navigator>
  );
}
