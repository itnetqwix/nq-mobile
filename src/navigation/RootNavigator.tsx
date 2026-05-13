import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { BrandedSessionLoader } from "../components/brand/BrandedSessionLoader";
import { useAuth } from "../features/auth/context/AuthContext";
import { InstantLessonStatusBanner } from "../features/instant-lesson/InstantLessonStatusBanner";
import { InstantLessonTraineeModal } from "../features/instant-lesson/InstantLessonTraineeModal";
import { InstantLessonTrainerModal } from "../features/instant-lesson/InstantLessonTrainerModal";
import { MeetingRouter } from "../features/calling/screens/MeetingRouter";
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
        screenOptions={{
          headerShown: false,
          /** Global iOS swipe-back gesture + Android horizontal slide for parity.
           *  Individual screens (Meeting) override this where appropriate. */
          gestureEnabled: true,
          gestureDirection: "horizontal",
          animation: "slide_from_right",
        }}
      >
        {signedIn ? (
          <>
            <Stack.Screen name="Main" component={DashboardDrawerShell} />
            <Stack.Screen
              name="Meeting"
              component={MeetingRouter}
              options={{
                headerShown: false,
                presentation: "fullScreenModal",
                animation: "slide_from_bottom",
                /** Lock the swipe-back gesture inside an active call — a stray
                 *  edge swipe must never drop the user out. They leave via the
                 *  explicit "End" action in ActionButtons. */
                gestureEnabled: false,
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
