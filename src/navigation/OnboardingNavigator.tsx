import React, { useEffect, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { VerifyContactScreen } from "../features/verification/screens/VerifyContactScreen";
import { ProfileFaceScreen } from "../features/verification/screens/ProfileFaceScreen";
import { PendingReviewScreen } from "../features/verification/screens/PendingReviewScreen";
import { getVerificationStatus } from "../features/verification/verificationApi";
import { useAuth } from "../features/auth/context/AuthContext";
import { nestedStackScreenOptions } from "./stackTransitions";

export type OnboardingStackParamList = {
  Contact: undefined;
  Profile: undefined;
  Pending: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

type Props = { onComplete: () => void };

function stepToRoute(
  step: string | null | undefined,
  contactSubstep?: string | null
): keyof OnboardingStackParamList {
  if (contactSubstep === "complete" || step === "contact_verified") {
    if (step === "under_review" || step === "completed") return "Pending";
    if (step === "profile_face_complete") return "Profile";
    return "Profile";
  }
  if (step === "account_created" || contactSubstep === "email" || contactSubstep === "phone") {
    return "Contact";
  }
  if (step === "profile_face_complete") return "Profile";
  return "Pending";
}

export function OnboardingNavigator({ onComplete }: Props) {
  const { user } = useAuth();
  const [initialRoute, setInitialRoute] = useState<keyof OnboardingStackParamList | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getVerificationStatus();
        if (!cancelled) setInitialRoute(stepToRoute(s.step, s.contact_substep));
      } catch {
        const tv = (user?.trainer_verification || {}) as Record<string, unknown>;
        if (!cancelled) setInitialRoute(stepToRoute(String(tv.onboarding_step || "account_created")));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator initialRouteName={initialRoute} screenOptions={nestedStackScreenOptions()}>
      <Stack.Screen name="Contact">
        {({ navigation }) => (
          <VerifyContactScreen onDone={() => navigation.navigate("Profile")} />
        )}
      </Stack.Screen>
      <Stack.Screen name="Profile">
        {({ navigation }) => (
          <ProfileFaceScreen onDone={() => navigation.navigate("Pending")} />
        )}
      </Stack.Screen>
      <Stack.Screen name="Pending">
        {() => <PendingReviewScreen onApproved={onComplete} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
