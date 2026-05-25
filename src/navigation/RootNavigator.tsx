import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { BrandedSessionLoader } from "../components/brand/BrandedSessionLoader";
import { AppUnlockGate } from "../features/auth/components/AppUnlockGate";
import { useAuth } from "../features/auth/context/AuthContext";
import { OnboardingNavigator } from "./OnboardingNavigator";
import { TrainerProfileSetupNavigator } from "./TrainerProfileSetupNavigator";
import { needsTrainerProfileSetup } from "../features/trainer-profile/lib/trainerProfileSetup";
import { AccountType } from "../constants/accountType";
import { useTrainerVerificationGate } from "../features/verification/hooks/useTrainerVerificationGate";
import { AccountRejectedScreen } from "../features/verification/screens/AccountRejectedScreen";
import { GracePeriodBanner } from "../features/verification/components/GracePeriodBanner";
import { InstantLessonStatusBanner } from "../features/instant-lesson/InstantLessonStatusBanner";
import { InstantLessonTraineeModal } from "../features/instant-lesson/InstantLessonTraineeModal";
import { InstantLessonIncomingCallOverlay } from "../features/instant-lesson/components/InstantLessonIncomingCallOverlay";
import { InstantLessonTrainerModal } from "../features/instant-lesson/InstantLessonTrainerModal";
import { MeetingRouter } from "../features/calling/screens/MeetingRouter";
import { NotificationToast } from "../features/notifications/NotificationToast";
import { OnboardingWalkthrough } from "../features/onboarding/OnboardingWalkthrough";
import { AuthNavigator } from "./AuthNavigator";
import { DashboardDrawerShell } from "./DashboardDrawerShell";
import { SystemStateScreen } from "../features/system-states/screens/SystemStateScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

function MainWithAppUnlock() {
  return (
    <AppUnlockGate>
      <DashboardDrawerShell />
    </AppUnlockGate>
  );
}

/** Guest browse — same dashboard shell, no biometric gate or auth-only overlays. */
function GuestBrowseShell() {
  return <DashboardDrawerShell />;
}

export function RootNavigator() {
  const { status, refreshUser, user, accountType } = useAuth();
  const { refetchVerificationGate, ...verificationGate } = useTrainerVerificationGate();
  const [startVerificationEarly, setStartVerificationEarly] = useState(false);

  useEffect(() => {
    if (status !== "signedIn") setStartVerificationEarly(false);
  }, [status]);

  const authLoading = status === "loading";
  const signedIn = status === "signedIn";
  const gateLoading = signedIn && verificationGate.loading;

  if (authLoading || gateLoading) {
    return <BrandedSessionLoader />;
  }

  const isAccountRejected = signedIn && String(user?.status ?? "").toLowerCase() === "rejected";

  const showTrainerProfileSetup =
    signedIn &&
    !isAccountRejected &&
    accountType === AccountType.TRAINER &&
    needsTrainerProfileSetup(accountType, user);

  const showVerificationWizard =
    signedIn &&
    !isAccountRejected &&
    !showTrainerProfileSetup &&
    (verificationGate.required || startVerificationEarly);

  if (isAccountRejected) {
    return (
      <AccountRejectedScreen
        onReapplied={() => {
          void refreshUser();
          refetchVerificationGate();
        }}
      />
    );
  }

  if (showTrainerProfileSetup) {
    return (
      <TrainerProfileSetupNavigator
        onComplete={() => {
          void refreshUser();
        }}
      />
    );
  }

  if (showVerificationWizard) {
    return (
      <OnboardingNavigator
        onComplete={() => {
          setStartVerificationEarly(false);
          void refreshUser();
          refetchVerificationGate();
        }}
      />
    );
  }

  return (
    <>
      <Stack.Navigator
        key={signedIn ? "signedIn" : "guestBrowse"}
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          gestureDirection: "horizontal",
          animation: "slide_from_right",
          /**
           * Uniform 240 ms — same family as `mainStackHeaderOptions`
           * (220 ms) so the timing reads consistent even when a tap
           * crosses both navigators. iOS-default is closer to 350 ms
           * which feels heavy on modern devices.
           */
          animationDuration: 240,
        }}
      >
        {signedIn ? (
          <>
            <Stack.Screen name="Main" component={MainWithAppUnlock} />
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
            <Stack.Screen
              name="Auth"
              component={AuthNavigator}
              options={{
                presentation: "fullScreenModal",
                animation: "slide_from_bottom",
                headerShown: false,
                gestureEnabled: true,
              }}
            />
            <Stack.Screen
              name="SystemState"
              component={SystemStateScreen}
              options={{
                presentation: "modal",
                animation: "fade",
                headerShown: false,
              }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={GuestBrowseShell} />
            <Stack.Screen
              name="Auth"
              component={AuthNavigator}
              options={{
                presentation: "fullScreenModal",
                animation: "slide_from_bottom",
                headerShown: false,
                gestureEnabled: true,
              }}
            />
            <Stack.Screen
              name="SystemState"
              component={SystemStateScreen}
              options={{
                presentation: "modal",
                animation: "fade",
                headerShown: false,
              }}
            />
          </>
        )}
      </Stack.Navigator>

      {signedIn && (
        <>
          {verificationGate.inGracePeriod && verificationGate.graceDaysRemaining > 0 ? (
            <GracePeriodBanner
              daysRemaining={verificationGate.graceDaysRemaining}
              onCompleteVerification={() => setStartVerificationEarly(true)}
            />
          ) : null}
          <InstantLessonIncomingCallOverlay />
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
