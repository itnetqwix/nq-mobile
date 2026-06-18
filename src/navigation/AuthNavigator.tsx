import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useRef } from "react";
import { useAuth } from "../features/auth/context/AuthContext";
import { ForgotPasswordScreen } from "../features/auth/screens/ForgotPasswordScreen";
import { LoginScreen } from "../features/auth/screens/LoginScreen";
import { MagicLinkRequestScreen } from "../features/auth/screens/MagicLinkRequestScreen";
import { MagicLinkVerifyScreen } from "../features/auth/screens/MagicLinkVerifyScreen";
import { SignUpScreen } from "../features/auth/screens/SignUpScreen";
import { WakeUpScreen } from "../features/auth/screens/WakeUpScreen";
import { LegalDocumentScreen } from "../features/content/screens/LegalDocumentScreen";
import type { RootStackParamList } from "./types";
import type { AuthStackParamList } from "./types";
import type { NavigatorScreenParams, RouteProp } from "@react-navigation/native";

const Stack = createNativeStackNavigator<AuthStackParamList>();

type AuthRoute = RouteProp<RootStackParamList, "Auth">;

export function AuthNavigator() {
  const route = useRoute<AuthRoute>();
  const navigation = useNavigation();
  const { status } = useAuth();
  const dismissedAfterSignInRef = useRef(false);
  const authParams = route.params as NavigatorScreenParams<AuthStackParamList> | undefined;
  const initialScreen =
    authParams && "screen" in authParams && authParams.screen === "SignUp"
      ? "SignUp"
      : "Login";

  useEffect(() => {
    if (status !== "signedIn") {
      dismissedAfterSignInRef.current = false;
      return;
    }
    if (dismissedAfterSignInRef.current) return;
    dismissedAfterSignInRef.current = true;
    const parent = navigation.getParent();
    if (parent?.canGoBack()) {
      parent.goBack();
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [status, navigation]);

  return (
    <Stack.Navigator
      initialRouteName={initialScreen}
      screenOptions={{
        headerShown: false,
        headerTitleAlign: "center",
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ title: "Reset password" }}
      />
      <Stack.Screen name="MagicLinkRequest" component={MagicLinkRequestScreen} />
      <Stack.Screen name="MagicLinkVerify" component={MagicLinkVerifyScreen} />
      <Stack.Screen
        name="WakeUp"
        component={WakeUpScreen}
        options={{ title: "Wake up account" }}
      />
      <Stack.Screen
        name="LegalDocument"
        component={LegalDocumentScreen}
        options={{ headerShown: true, title: "Legal" }}
      />
    </Stack.Navigator>
  );
}
