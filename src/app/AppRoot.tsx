import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useMemo } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../features/auth/context/AuthContext";
import { SocketProvider } from "../features/socket/SocketContext";
import { InstantLessonProvider } from "../features/instant-lesson/InstantLessonContext";
import { RootNavigator } from "../navigation/RootNavigator";
import type { RootStackParamList } from "../navigation/types";

const navigationRef = createNavigationContainerRef<RootStackParamList>();

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
    if (navigationRef.isReady()) {
      navigationRef.navigate("Meeting", { lessonId });
    }
  }, []);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SocketProvider>
              <InstantLessonProvider onNavigateToMeeting={navigateToMeeting}>
                <NavigationContainer ref={navigationRef}>
                  <StatusBar style="dark" />
                  <RootNavigator />
                </NavigationContainer>
              </InstantLessonProvider>
            </SocketProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
