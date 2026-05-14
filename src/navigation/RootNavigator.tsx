import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { BrandedSessionLoader } from "../components/brand/BrandedSessionLoader";
import { useAuth } from "../features/auth/context/AuthContext";
import { InstantLessonStatusBanner } from "../features/instant-lesson/InstantLessonStatusBanner";
import { InstantLessonTraineeModal } from "../features/instant-lesson/InstantLessonTraineeModal";
import { InstantLessonTrainerModal } from "../features/instant-lesson/InstantLessonTrainerModal";
import { MeetingRouter } from "../features/calling/screens/MeetingRouter";
import { NotificationToast } from "../features/notifications/NotificationToast";
import { OnboardingWalkthrough } from "../features/onboarding/OnboardingWalkthrough";
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
      <Stack.Navigator
        key={signedIn ? "signedIn" : "signedOut"}
        screenOptions={{
          headerShown: false,
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
                gestureEnabled: false,
              }}
            />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>

      {signedIn && (
        <>
          <InstantLessonTrainerModal />
          <InstantLessonTraineeModal />
          <InstantLessonStatusBanner />
          <NotificationToast />
          <OnboardingWalkthrough />
        </>
      )}
    </>
  );
}
