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
import { StackSwipeBackShell } from "../../../navigation/StackSwipeBackShell";

export type ShellSurfaceScreenProps = NativeStackScreenProps<HomeStackParamList, "ShellSurface">;

export function ShellSurfaceScreen({ route }: ShellSurfaceScreenProps) {
  const { surfaceId } = route.params;

  const wrap = (node: React.ReactNode) => (
    <StackSwipeBackShell>{node}</StackSwipeBackShell>
  );

  switch (surfaceId) {
    case "notifications":
      return wrap(<NotificationsScreen />);
    case "wallet":
      return wrap(
        <WalletNavigator
          initialRouteName={route.params.walletScreen}
          initialParams={route.params.walletParams}
        />
      );
    case "transactions":
      return wrap(<TransactionsScreen />);
    case "clips":
      return wrap(<ClipsScreen />);
    case "gamePlans":
      return wrap(<GamePlansScreen />);
    case "savedLessons":
      return wrap(<SavedLessonsScreen />);
    case "invite":
      return wrap(<InviteFriendsScreen />);
    case "settings":
      return wrap(<SettingsScreen />);
    case "trainerSchedule":
      return wrap(<TrainerScheduleScreen />);
    case "editProfile":
      return wrap(<EditProfileScreen />);
    case "reportIssue":
      return wrap(<ReportIssueScreen />);
    default:
      return null;
  }
}
