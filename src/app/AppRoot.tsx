import {
  createPersistedQueryClient,
  migrateQueryPersistFromAsyncStorage,
  persister,
  PERSIST_MAX_AGE_MS,
  PersistQueryClientProvider,
} from "../lib/queryPersist";
import { StripeProvider } from "@stripe/stripe-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  STRIPE_APPLE_MERCHANT_IDENTIFIER,
  STRIPE_PUBLISHABLE_KEY,
} from "../config/env";
import { AuthProvider } from "../features/auth/context/AuthContext";
import { hydrateLastAuthMethod } from "../features/auth/lib/lastAuthMethod";
import { hydratePendingAuthIntent } from "../features/auth/lib/pendingAuthIntent";
import { hydrateCompareTrainersStore } from "../features/bookexpert/lib/compareTrainersStore";
import { startNetInfoListener } from "../lib/network/netInfoBootstrap";
import { bootstrapCallRejoinStore } from "../features/calling/callRejoinStore";
import {
  SystemGateProvider,
  SystemStateProvider,
} from "../features/system-states";
import { useSessionExpiredNavigation } from "../features/system-states/hooks/useSessionExpiredNavigation";
import { useUpdateRequiredGate } from "../features/system-states/hooks/useUpdateRequiredGate";
import { AuthSessionSocketBridge } from "../features/auth/AuthSessionSocketBridge";
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
import { NetworkStatusBanner } from "../components/system/NetworkStatusBanner";
import {
  hydrateOfflineChatQueue,
  useOfflineChatQueueFlusher,
} from "../features/chats/lib/offlineChatQueue";
import { useOfflineActionQueueFlusher } from "../lib/offline/offlineActionQueue";
import "../features/sessions/offlineBookingActionQueue";
import "../features/capture/captureUploadQueue";
import { useOfflineChatMutationsFlusher } from "../features/chats/lib/offlineChatMutations";
import { ThemeProvider } from "../theme/ThemeContext";
import { ThemedNavigationContainer } from "./ThemedNavigationContainer";
import { CoachMarkOverlay, CoachMarkProvider } from "../features/onboarding";
import i18n from "../i18n";
import { normalizeAppLocale } from "../i18n/languages";
import { loadPersistedAppLocale } from "../i18n/localeStorage";
import { initMobileSentry } from "../lib/sentry";
import { queryKeys } from "../lib/queryKeys";
import { StoreProvider } from "../store/StoreProvider";
import { AppBootstrapGate } from "../components/splash";
import { CmsLiveRefreshBridge } from "../features/content/CmsLiveRefreshBridge";
import { hydrateHotStorageFallback } from "../lib/storage/mmkvHotStorage";
import { applyHapticsPreference } from "../lib/haptics";
import { hydrateHapticsPreference } from "../lib/hapticsPreference";
import { setGlobalQueryClient } from "../store/queryClientRef";

initMobileSentry();

function SystemStateHooks() {
  useSessionExpiredNavigation();
  useUpdateRequiredGate(true);
  useOfflineChatQueueFlusher();
  useOfflineChatMutationsFlusher();
  useOfflineActionQueueFlusher();
  return null;
}

export function AppRoot() {
  const [localeReady, setLocaleReady] = useState(false);
  const queryClient = useMemo(() => createPersistedQueryClient(), []);

  useEffect(() => {
    setGlobalQueryClient(queryClient);
  }, [queryClient]);

  useEffect(() => {
    return startNetInfoListener();
  }, []);

  useEffect(() => {
    void (async () => {
      await hydrateHotStorageFallback();
      await migrateQueryPersistFromAsyncStorage();
      await hydrateHapticsPreference(applyHapticsPreference);
    })();
    void hydratePendingAuthIntent();
    void hydrateLastAuthMethod();
    void bootstrapCallRejoinStore();
    void hydrateOfflineChatQueue();
    void hydrateCompareTrainersStore();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const stored = await loadPersistedAppLocale();
        if (stored) await i18n.changeLanguage(normalizeAppLocale(stored));
      } finally {
        setLocaleReady(true);
      }
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
      <AppBootstrapGate appInitReady={localeReady}>
        <StripeProvider
          publishableKey={STRIPE_PUBLISHABLE_KEY || "pk_test_placeholder"}
          merchantIdentifier={
            STRIPE_APPLE_MERCHANT_IDENTIFIER || undefined
          }
        >
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
                    query.queryKey[0] === queryKeys.sessions.all[0],
                },
              }}
            >
              <AuthProvider>
                <SystemStateProvider>
                  <SystemGateProvider>
                    <SystemStateHooks />
                    <SocketProvider>
                      <SocketQueryInvalidationBridge />
                      <AuthSessionSocketBridge />
                      <NotificationProvider>
                        <SessionBookingProvider>
                          <InstantLessonProvider onNavigateToMeeting={navigateToMeeting}>
                            <CoachMarkProvider>
                              <PushNotificationBridge />
                              <InstantLessonCallKeepBridge />
                              <TrainerOnlinePresenceBridge />
                              <SessionLifecycleBridge />
                              <NetworkStatusBanner />
                              <CmsLiveRefreshBridge />
                              <ThemedNavigationContainer />
                              <CoachMarkOverlay />
                            </CoachMarkProvider>
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
      </AppBootstrapGate>
      </SafeAreaProvider>
      </StoreProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});