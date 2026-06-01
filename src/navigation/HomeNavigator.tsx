import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { useThemeColors } from "../theme";
import { dashboardRouteById } from "../features/dashboard/config/dashboardRoutes";
import { shellSurfaceById } from "../features/dashboard/config/shellSurfaces";
import { DashboardHomeEntry } from "./DashboardHomeEntry";
import { DashboardFeatureScreen } from "../features/dashboard/screens/DashboardFeatureScreen";
import { ShellSurfaceScreen } from "../features/dashboard/screens/ShellSurfaceScreen";
import { TransactionDetailScreen } from "../features/dashboard/screens/TransactionDetailScreen";
import { ReportIssueScreen } from "../features/dashboard/screens/ReportIssueScreen";
import { ActiveSessionsScreen } from "../features/auth/screens/ActiveSessionsScreen";
import { StoragePlanScreen } from "../features/settings/screens/StoragePlanScreen";
import { ArchivedChatsScreen } from "../features/chats/screens/ArchivedChatsScreen";
import { NotificationPreferencesScreen } from "../features/notifications/screens/NotificationPreferencesScreen";
import { BlockedUsersScreen } from "../features/settings/screens/BlockedUsersScreen";
import { DataExportScreen } from "../features/settings/screens/DataExportScreen";
import { TwoFactorScreen } from "../features/settings/screens/TwoFactorScreen";
import { BlogsScreen } from "../features/content/screens/BlogsScreen";
import { BlogPostScreen } from "../features/content/screens/BlogPostScreen";
import { LegalDocumentScreen } from "../features/content/screens/LegalDocumentScreen";
import i18n from "../i18n";
import { localizedDashboardTitle } from "../i18n/dashboardRouteI18n";
import { localizedShellTitle } from "../i18n/shellSurfaceI18n";
import { mainStackHeaderOptions } from "./mainTabHeaderOptions";
import type { HomeStackParamList } from "./types";

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeNavigator() {
  const c = useThemeColors();
  const header = mainStackHeaderOptions(c);

  return (
    <Stack.Navigator
      initialRouteName="DashboardHome"
      screenOptions={{
        ...header,
        headerShown: true,
      }}
    >
      <Stack.Screen
        name="DashboardHome"
        component={DashboardHomeEntry}
        options={{ title: i18n.t("nav.dashboard") }}
      />
      <Stack.Screen
        name="DashboardFeature"
        component={DashboardFeatureScreen}
        options={({ route }) => {
          const meta = dashboardRouteById(route.params.featureId);
          return {
            title: meta ? localizedDashboardTitle(i18n.t, meta) : i18n.t("nav.dashboard"),
          };
        }}
      />
      <Stack.Screen
        name="ShellSurface"
        component={ShellSurfaceScreen}
        options={({ route }) => {
          const meta = shellSurfaceById(route.params.surfaceId);
          return {
            title: meta ? localizedShellTitle(i18n.t, meta) : "NetQwix",
            headerShown: true,
          };
        }}
      />
      <Stack.Screen
        name="TransactionDetail"
        component={TransactionDetailScreen}
        options={{ title: i18n.t("wallet.transaction") }}
      />
      <Stack.Screen
        name="ReportIssue"
        component={ReportIssueScreen}
        options={{ title: i18n.t("nav.reportIssue") }}
      />
      <Stack.Screen
        name="ActiveSessions"
        component={ActiveSessionsScreen}
        options={{ title: i18n.t("auth.activeSessions") }}
      />
      <Stack.Screen
        name="StoragePlan"
        component={StoragePlanScreen}
        options={{ title: i18n.t("storage.title") }}
      />
      <Stack.Screen
        name="ArchivedChats"
        component={ArchivedChatsScreen}
        options={{ title: i18n.t("chats.archivedTitle") }}
      />
      <Stack.Screen
        name="NotificationPreferences"
        component={NotificationPreferencesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BlockedUsers"
        component={BlockedUsersScreen}
        options={{ title: i18n.t("blockList.title", { defaultValue: "Blocked accounts" }) }}
      />
      <Stack.Screen
        name="DataExport"
        component={DataExportScreen}
        options={{ title: i18n.t("dataExport.title", { defaultValue: "Export my data" }) }}
      />
      <Stack.Screen
        name="TwoFactor"
        component={TwoFactorScreen}
        options={{ title: i18n.t("twoFactor.title", { defaultValue: "Two-factor authentication" }) }}
      />
      <Stack.Screen
        name="Blogs"
        component={BlogsScreen}
        options={{ title: i18n.t("cms.blogsTitle") }}
      />
      <Stack.Screen
        name="BlogPost"
        component={BlogPostScreen}
        options={{ title: i18n.t("cms.blogPostTitle") }}
      />
      <Stack.Screen
        name="LegalDocument"
        component={LegalDocumentScreen}
        options={{ title: "" }}
      />
    </Stack.Navigator>
  );
}
