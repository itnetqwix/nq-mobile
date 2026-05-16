import type { NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { DashboardRouteId } from "../features/dashboard/config/dashboardRoutes";
import type { ShellSurfaceMeta } from "../features/dashboard/config/shellSurfaces";

export type AuthStackParamList = {
  Login: undefined;
  SignUp: { prefillEmail?: string } | undefined;
  ForgotPassword: undefined;
};

export type ShellSurfaceRouteId = ShellSurfaceMeta["id"];

export type HomeStackParamList = {
  DashboardHome: undefined;
  DashboardFeature: { featureId: DashboardRouteId; bookLessonTrainerId?: string };
  ShellSurface: { surfaceId: ShellSurfaceRouteId };
  TransactionDetail: { bookingId?: string; ledgerEntryId?: string };
  ReportIssue: {
    bookingId?: string;
    prefillSubject?: string;
    prefillDescription?: string;
  };
};

/** @deprecated Use HomeStackParamList */
export type MenuStackParamList = HomeStackParamList;

export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Schedule: undefined;
  Chats: undefined;
};

/** Drawer wraps the bottom-tab shell — mirrors web `DashboardLayout` + left rail. */
export type DashboardDrawerParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList> | undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Meeting: { lessonId: string };
};

export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = BottomTabScreenProps<
  MainTabParamList,
  T
>;
