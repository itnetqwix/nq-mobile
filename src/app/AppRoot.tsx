import {
  createPersistedQueryClient,
  persister,
  PERSIST_MAX_AGE_MS,
  PersistQueryClientProvider,
} from "../lib/queryPersist";
import { StripeProvider } from "@stripe/stripe-react-native";
import React, { useCallback, useEffect, useMemo } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { STRIPE_PUBLISHABLE_KEY } from "../config/env";
import { AuthProvider } from "../features/auth/context/AuthContext";
import {
  SystemGateProvider,
  SystemStateProvider,
} from "../features/system-states";
import { useSessionExpiredNavigation } from "../features/system-states/hooks/useSessionExpiredNavigation";
import { useUpdateRequiredGate } from "../features/system-states/hooks/useUpdateRequiredGate";
import { SocketProvider } from "../features/socket/SocketContext";
import { SocketQueryInvalidationBridge } from "../features/socket/SocketQueryInvalidationBridge";
import { InstantLessonProvider } from "../features/instant-lesson/InstantLessonContext";
import { NotificationProvider } from "../features/notifications/NotificationContext";
import { SessionBookingProvider } from "../features/sessions/SessionBookingContext";
import { SessionLifecycleBridge } from "../features/sessions/SessionLifecycleBridge";
import { PushNotificationBridge } from "../features/notifications/PushNotificationBridge";
import { InstantLessonCallKeepBridge } from "../features/instant-lesson/InstantLessonCallKeepBridge";
import { TrainerOnlinePresenceBridge } from "../features/instant-lesson/TrainerOnlinePresenceBridge";
import { navigationRef } from "../navigation/navigationRef";
import { LoaderProvider } from "../components/brand/LoaderProvider";
import { warmLoaderTipsCache } from "../components/brand/loaderTips/loaderTipsService";
import { ThemeProvider } from "../theme/ThemeContext";
import { ThemedNavigationContainer } from "./ThemedNavigationContainer";
import i18n from "../i18n";
import { normalizeAppLocale } from "../i18n/languages";
import { loadPersistedAppLocale } from "../i18n/localeStorage";
import { StoreProvider } from "../store/StoreProvider";
import { setGlobalQueryClient } from "../store/queryClientRef";

function SystemStateHooks() {
  useSessionExpiredNavigation();
  useUpdateRequiredGate(true);
  return null;
}

export function AppRoot() {
  const queryClient = useMemo(() => createPersistedQueryClient(), []);

  useEffect(() => {
    setGlobalQueryClient(queryClient);
  }, [queryClient]);

  useEffect(() => {
    warmLoaderTipsCache();
  }, []);

  useEffect(() => {
    void (async () => {
      const stored = await loadPersistedAppLocale();
      if (stored) await i18n.changeLanguage(normalizeAppLocale(stored));
    })();
  }, []);

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
      <StoreProvider>
      <SafeAreaProvider>
        <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
          <ThemeProvider>
            <LoaderProvider>
            <PersistQueryClientProvider
              client={queryClient}
              persistOptions={{
                persister,
                maxAge: PERSIST_MAX_AGE_MS,
                dehydrateOptions: {
                  shouldDehydrateQuery: (query) =>
                    Array.isArray(query.queryKey) &&
                    query.queryKey[0] === "sessions",
                },
              }}
            >
              <AuthProvider>
                <SystemStateProvider>
                  <SystemGateProvider>
                    <SystemStateHooks />
                    <SocketProvider>
                      <SocketQueryInvalidationBridge />
                      <NotificationProvider>
                        <SessionBookingProvider>
                          <InstantLessonProvider onNavigateToMeeting={navigateToMeeting}>
                            <PushNotificationBridge />
                            <InstantLessonCallKeepBridge />
                            <TrainerOnlinePresenceBridge />
                            <SessionLifecycleBridge />
                            <ThemedNavigationContainer />
                          </InstantLessonProvider>
                        </SessionBookingProvider>
                      </NotificationProvider>
                    </SocketProvider>
                  </SystemGateProvider>
                </SystemStateProvider>
              </AuthProvider>
            </PersistQueryClientProvider>
            </LoaderProvider>
          </ThemeProvider>
        </StripeProvider>
      </SafeAreaProvider>
      </StoreProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});