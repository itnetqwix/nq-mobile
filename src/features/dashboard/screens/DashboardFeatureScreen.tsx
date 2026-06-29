import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect } from "react";
import { EmptyState } from "../../../components/ui";
import { useAuth } from "../../auth/context/AuthContext";
import { useGuestMode } from "../../auth/hooks/useGuestMode";
import { useRequireAuth } from "../../auth/hooks/useRequireAuth";
import type { MenuStackParamList } from "../../../navigation/types";
import { isDashboardRouteAllowed } from "../config/dashboardRoutes";
import { AccountType } from "../../../constants/accountType";
import { UpcomingSessionsScreen } from "../../sessions/screens/UpcomingSessionsScreen";
import { TrainerScheduleTabs } from "../../schedule/screens/ScheduleScreen";
import { BookExpertScreen } from "../../bookexpert/screens/BookExpertScreen";
import { StudentsScreen } from "../../students/screens/StudentsScreen";
import { FriendsScreen } from "../../friends/screens/FriendsScreen";
import { CommunityScreen } from "./CommunityScreen";
import { ContactUsScreen } from "./ContactUsScreen";
import { AboutUsScreen } from "./AboutUsScreen";
import { FaqScreen } from "./FaqScreen";
import { BlogsScreen } from "../../content/screens/BlogsScreen";
import { MeetingRoomScreen } from "./MeetingRoomScreen";
import { PracticeSessionScreen } from "./PracticeSessionScreen";
import { InstantBookingScreen } from "./InstantBookingScreen";
import { StackSwipeBackShell } from "../../../navigation/StackSwipeBackShell";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

export type DashboardFeatureScreenProps = NativeStackScreenProps<MenuStackParamList, "DashboardFeature">;

export function DashboardFeatureScreen({ route, navigation }: DashboardFeatureScreenProps) {
  const { t } = useAppTranslation();
  const { featureId, bookLessonTrainerId } = route.params;
  const { accountType } = useAuth();
  const isGuest = useGuestMode();
  const { redirectToAuth } = useRequireAuth();

  const allowed = isDashboardRouteAllowed(featureId, accountType, { guest: isGuest });

  useEffect(() => {
    if (isGuest && !allowed) {
      redirectToAuth("Login", { messageKey: "guest.signInToContinue" });
      navigation.goBack();
    }
  }, [isGuest, allowed, redirectToAuth, navigation]);

  if (!allowed) {
    return (
      <StackSwipeBackShell>
        <EmptyState
          icon="lock-closed-outline"
          title={t("dashboard.notAvailable")}
          description={t("dashboard.notAvailableTraineeOnly")}
        />
      </StackSwipeBackShell>
    );
  }

  const wrap = (node: React.ReactNode) => <StackSwipeBackShell>{node}</StackSwipeBackShell>;

  switch (featureId) {
    case "upcoming-sessions":
      return wrap(
        accountType === AccountType.TRAINER ? (
          <TrainerScheduleTabs />
        ) : (
          <UpcomingSessionsScreen />
        )
      );
    case "book-lesson":
      return wrap(<BookExpertScreen bookLessonTrainerId={bookLessonTrainerId} />);
    case "students":
      return wrap(<StudentsScreen />);
    case "friends":
      return wrap(
        <FriendsScreen
          initialTab={route.params.friendsTab as any}
          preselectedFriendId={route.params.preselectedFriendId}
        />
      );
    case "my-community":
      return wrap(<CommunityScreen />);
    case "contact-us":
      return wrap(<ContactUsScreen />);
    case "about-us":
      return wrap(<AboutUsScreen />);
    case "faq":
      return wrap(<FaqScreen />);
    case "blogs":
      return wrap(<BlogsScreen />);
    case "meeting-room":
      return wrap(<MeetingRoomScreen />);
    case "practice-session":
      return wrap(<PracticeSessionScreen />);
    case "instant-booking":
      return wrap(<InstantBookingScreen />);
    default:
      return null;
  }
}
