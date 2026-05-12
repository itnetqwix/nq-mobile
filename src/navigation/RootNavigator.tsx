import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { BrandedSessionLoader } from "../components/brand/BrandedSessionLoader";
import { useAuth } from "../features/auth/context/AuthContext";
import { InstantLessonStatusBanner } from "../features/instant-lesson/InstantLessonStatusBanner";
import { InstantLessonTraineeModal } from "../features/instant-lesson/InstantLessonTraineeModal";
import { InstantLessonTrainerModal } from "../features/instant-lesson/InstantLessonTrainerModal";
import { MeetingScreen } from "../features/meeting/screens/MeetingScreen";
import { NotificationToast } from "../features/notifications/NotificationToast";
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
          <InstantLessonStatusBanner />
          {/* Live notification banner — uses the navigation context so it can deep-link
              into the inbox; lives inside NavigationContainer scope by virtue of being
              rendered from RootNavigator. */}
          <NotificationToast />
        </>
      )}

      {/**
       * Auth vs app stacks must not register the same routes at once — otherwise the native
       * stack can keep "Main" active after `status` flips to `signedOut`. Pattern:
       * https://reactnavigation.org/docs/auth-flow
       */}
      <Stack.Navigator
        key={signedIn ? "signedIn" : "signedOut"}
        screenOptions={{ headerShown: false }}
      >
        {signedIn ? (
          <>
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
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </>
  );
}
