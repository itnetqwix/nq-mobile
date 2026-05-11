import type { NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { DashboardRouteId } from "../features/dashboard/config/dashboardRoutes";
import type { ShellSurfaceMeta } from "../features/dashboard/config/shellSurfaces";

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

export type ShellSurfaceRouteId = ShellSurfaceMeta["id"];

export type MenuStackParamList = {
  MenuHome: undefined;
  DashboardFeature: { featureId: DashboardRouteId };
  ShellSurface: { surfaceId: ShellSurfaceRouteId };
};

export type MainTabParamList = {
  Home: undefined;
  Schedule: undefined;
  Chats: undefined;
  Menu: NavigatorScreenParams<MenuStackParamList>;
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
