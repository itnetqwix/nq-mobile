import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import type { HomeStackParamList } from "../../../navigation/types";
import { NotificationsScreen } from "../../notifications/screens/NotificationsScreen";
import { InviteFriendsScreen } from "./InviteFriendsScreen";
import { TransactionsScreen } from "./TransactionsScreen";
import { ClipsScreen } from "./ClipsScreen";
import { EditProfileScreen } from "./EditProfileScreen";
import { GamePlansScreen } from "./GamePlansScreen";
import { ReportIssueScreen } from "./ReportIssueScreen";
import { SavedLessonsScreen } from "./SavedLessonsScreen";
import { SettingsScreen } from "./SettingsScreen";
import { TrainerScheduleScreen } from "./TrainerScheduleScreen";
import { WalletNavigator } from "../../wallet/navigation/WalletNavigator";

export type ShellSurfaceScreenProps = NativeStackScreenProps<HomeStackParamList, "ShellSurface">;

export function ShellSurfaceScreen({ route }: ShellSurfaceScreenProps) {
  const { surfaceId } = route.params;

  switch (surfaceId) {
    case "notifications":
      return <NotificationsScreen />;
    case "wallet":
      return <WalletNavigator />;
    case "transactions":
      return <TransactionsScreen />;
    case "clips":
      return <ClipsScreen />;
    case "gamePlans":
      return <GamePlansScreen />;
    case "savedLessons":
      return <SavedLessonsScreen />;
    case "invite":
      return <InviteFriendsScreen />;
    case "settings":
      return <SettingsScreen />;
    case "trainerSchedule":
      return <TrainerScheduleScreen />;
    case "editProfile":
      return <EditProfileScreen />;
    case "reportIssue":
      return <ReportIssueScreen />;
    default:
      return null;
  }
}
