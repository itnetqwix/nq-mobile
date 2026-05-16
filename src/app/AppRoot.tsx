import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StripeProvider } from "@stripe/stripe-react-native";
import React, { useCallback, useMemo } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { STRIPE_PUBLISHABLE_KEY } from "../config/env";
import { AuthProvider } from "../features/auth/context/AuthContext";
import { SocketProvider } from "../features/socket/SocketContext";
import { InstantLessonProvider } from "../features/instant-lesson/InstantLessonContext";
import { NotificationProvider } from "../features/notifications/NotificationContext";
import { SessionBookingProvider } from "../features/sessions/SessionBookingContext";
import { PushNotificationBridge } from "../features/notifications/PushNotificationBridge";
import { navigationRef } from "../navigation/navigationRef";
import { LoaderProvider } from "../components/brand/LoaderProvider";
import { ThemeProvider } from "../theme/ThemeContext";
import { ThemedNavigationContainer } from "./ThemedNavigationContainer";

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
            <LoaderProvider>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <SocketProvider>
                  <NotificationProvider>
                    <SessionBookingProvider>
                      <InstantLessonProvider onNavigateToMeeting={navigateToMeeting}>
                        <PushNotificationBridge />
                        <ThemedNavigationContainer />
                      </InstantLessonProvider>
                    </SessionBookingProvider>
                  </NotificationProvider>
                </SocketProvider>
              </AuthProvider>
            </QueryClientProvider>
            </LoaderProvider>
          </ThemeProvider>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
