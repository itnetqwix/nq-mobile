import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { BrandedSessionLoader } from "../components/brand/BrandedSessionLoader";
import { useAuth } from "../features/auth/context/AuthContext";
import { InstantLessonTrainerModal } from "../features/instant-lesson/InstantLessonTrainerModal";
import { MeetingScreen } from "../features/meeting/screens/MeetingScreen";
import { AuthNavigator } from "./AuthNavigator";
import { MainTabs } from "./MainTabs";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { status } = useAuth();

  if (status === "loading") {
    return <BrandedSessionLoader />;
  }

  const signedIn = status === "signedIn";

  return (
    <>
      {/* Global trainer modal — renders on top of any screen when a request arrives */}
      {signedIn && <InstantLessonTrainerModal />}

      <Stack.Navigator
        key={signedIn ? "signedIn" : "signedOut"}
        initialRouteName={signedIn ? "Main" : "Auth"}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Auth" component={AuthNavigator} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="Meeting"
          component={MeetingScreen}
          options={{
            headerShown: false,
            presentation: "fullScreenModal",
            animation: "slide_from_bottom",
          }}
        />
      </Stack.Navigator>
    </>
  );
}
