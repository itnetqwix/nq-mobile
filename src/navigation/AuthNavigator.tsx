import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useRoute } from "@react-navigation/native";
import React from "react";
import { ForgotPasswordScreen } from "../features/auth/screens/ForgotPasswordScreen";
import { LoginScreen } from "../features/auth/screens/LoginScreen";
import { MagicLinkRequestScreen } from "../features/auth/screens/MagicLinkRequestScreen";
import { MagicLinkVerifyScreen } from "../features/auth/screens/MagicLinkVerifyScreen";
import { SignUpScreen } from "../features/auth/screens/SignUpScreen";
import type { RootStackParamList } from "./types";
import type { AuthStackParamList } from "./types";
import type { NavigatorScreenParams, RouteProp } from "@react-navigation/native";

const Stack = createNativeStackNavigator<AuthStackParamList>();

type AuthRoute = RouteProp<RootStackParamList, "Auth">;

export function AuthNavigator() {
  const route = useRoute<AuthRoute>();
  const authParams = route.params as NavigatorScreenParams<AuthStackParamList> | undefined;
  const initialScreen =
    authParams && "screen" in authParams && authParams.screen === "SignUp"
      ? "SignUp"
      : "Login";

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
    </Stack.Navigator>
  );
}
