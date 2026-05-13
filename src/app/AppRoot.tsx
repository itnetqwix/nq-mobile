import { NavigationContainer } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StripeProvider } from "@stripe/stripe-react-native";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useMemo } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { STRIPE_PUBLISHABLE_KEY } from "../config/env";
import { AuthProvider } from "../features/auth/context/AuthContext";
import { SocketProvider } from "../features/socket/SocketContext";
import { InstantLessonProvider } from "../features/instant-lesson/InstantLessonContext";
import { NotificationProvider } from "../features/notifications/NotificationContext";
import { PushNotificationBridge } from "../features/notifications/PushNotificationBridge";
import { RootNavigator } from "../navigation/RootNavigator";
import { navigationRef } from "../navigation/navigationRef";
import { ThemeProvider } from "../theme/ThemeContext";

export function AppRoot() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 60_000,
          },
        },
      }),
    []
  );

  const navigateToMeeting = useCallback((lessonId: string) => {
    const go = () => {
      if (!navigationRef.isReady()) return false;
      navigationRef.navigate("Meeting", { lessonId });
      return true;
    };
    if (go()) return;
    /** First accept can arrive before the container finishes mounting — mirror web “both join” reliability. */
    setTimeout(() => {
      go();
    }, 400);
  }, []);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
          <ThemeProvider>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <SocketProvider>
                  <NotificationProvider>
                    <InstantLessonProvider onNavigateToMeeting={navigateToMeeting}>
                      <PushNotificationBridge />
                      <NavigationContainer ref={navigationRef}>
                        <StatusBar style="dark" />
                        <RootNavigator />
                      </NavigationContainer>
                    </InstantLessonProvider>
                  </NotificationProvider>
                </SocketProvider>
              </AuthProvider>
            </QueryClientProvider>
          </ThemeProvider>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
