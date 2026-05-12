import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { BrandedSessionLoader } from "../components/brand/BrandedSessionLoader";
import { useAuth } from "../features/auth/context/AuthContext";
import { InstantLessonTraineeModal } from "../features/instant-lesson/InstantLessonTraineeModal";
import { InstantLessonTrainerModal } from "../features/instant-lesson/InstantLessonTrainerModal";
import { MeetingScreen } from "../features/meeting/screens/MeetingScreen";
import { AuthNavigator } from "./AuthNavigator";
import { DashboardDrawerShell } from "./DashboardDrawerShell";
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
      {/* Global instant-lesson modals — survive navigation away from Instant Booking */}
      {signedIn && (
        <>
          <InstantLessonTrainerModal />
          <InstantLessonTraineeModal />
        </>
      )}

      <Stack.Navigator
        key={signedIn ? "signedIn" : "signedOut"}
        initialRouteName={signedIn ? "Main" : "Auth"}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Auth" component={AuthNavigator} />
        <Stack.Screen name="Main" component={DashboardDrawerShell} />
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
