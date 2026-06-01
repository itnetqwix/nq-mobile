import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import type { HomeStackParamList } from "../../../navigation/types";
import { NotificationsScreen } from "../../notifications/screens/NotificationsScreen";
import { InviteFriendsScreen } from "./InviteFriendsScreen";
import { TransactionsScreen } from "./TransactionsScreen";
import { ClipsScreen } from "./ClipsScreen";
import { MyLibrarySubmissionsScreen } from "../../clips/screens/MyLibrarySubmissionsScreen";
import { EditProfileScreen } from "./EditProfileScreen";
import { ProfessionalProfileScreen } from "../../trainer-profile/screens/ProfessionalProfileScreen";
import { GamePlansScreen } from "./GamePlansScreen";
import { ReportIssueScreen } from "./ReportIssueScreen";
import { SavedLessonsScreen } from "./SavedLessonsScreen";
import { useGuestMode } from "../../auth/hooks/useGuestMode";
import { GuestSettingsScreen } from "./GuestSettingsScreen";
import { SettingsScreen } from "./SettingsScreen";
import { TrainerScheduleScreen } from "./TrainerScheduleScreen";
import { WalletNavigator } from "../../wallet/navigation/WalletNavigator";
import { StackSwipeBackShell } from "../../../navigation/StackSwipeBackShell";
import { SupportChatScreen } from "../../support/SupportChatScreen";
import { DeleteAccountScreen } from "../../account-lifecycle/screens/DeleteAccountScreen";
import { HibernateAccountScreen } from "../../account-lifecycle/screens/HibernateAccountScreen";
import { TrainerReviewsScreen } from "./TrainerReviewsScreen";

export type ShellSurfaceScreenProps = NativeStackScreenProps<HomeStackParamList, "ShellSurface">;

export function ShellSurfaceScreen({ route }: ShellSurfaceScreenProps) {
  const { surfaceId } = route.params;
  const isGuest = useGuestMode();

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
    case "clipSubmissions":
      return wrap(<MyLibrarySubmissionsScreen />);
    case "gamePlans":
      return wrap(<GamePlansScreen />);
    case "savedLessons":
      return wrap(<SavedLessonsScreen />);
    case "invite":
      return wrap(<InviteFriendsScreen />);
    case "settings":
      return wrap(isGuest ? <GuestSettingsScreen /> : <SettingsScreen />);
    case "trainerSchedule":
      return wrap(<TrainerScheduleScreen />);
    case "editProfile":
      return wrap(<EditProfileScreen />);
    case "professionalProfile":
      return wrap(<ProfessionalProfileScreen />);
    case "reportIssue":
      return wrap(<ReportIssueScreen />);
    case "supportChat":
      return wrap(<SupportChatScreen />);
    case "deleteAccount":
      return wrap(<DeleteAccountScreen />);
    case "hibernateAccount":
      return wrap(<HibernateAccountScreen />);
    case "trainerReviews":
      return wrap(<TrainerReviewsScreen />);
    default:
      return null;
  }
}
