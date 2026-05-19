import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { EmptyState } from "../../../components/ui";
import { useAuth } from "../../auth/context/AuthContext";
import type { MenuStackParamList } from "../../../navigation/types";
import { isDashboardRouteAllowed } from "../config/dashboardRoutes";
import { UpcomingSessionsScreen } from "../../sessions/screens/UpcomingSessionsScreen";
import { BookExpertScreen } from "../../bookexpert/screens/BookExpertScreen";
import { StudentsScreen } from "../../students/screens/StudentsScreen";
import { FriendsScreen } from "../../friends/screens/FriendsScreen";
import { CommunityScreen } from "./CommunityScreen";
import { ContactUsScreen } from "./ContactUsScreen";
import { AboutUsScreen } from "./AboutUsScreen";
import { FaqScreen } from "./FaqScreen";
import { MeetingRoomScreen } from "./MeetingRoomScreen";
import { PracticeSessionScreen } from "./PracticeSessionScreen";
import { InstantBookingScreen } from "./InstantBookingScreen";
import { StackSwipeBackShell } from "../../../navigation/StackSwipeBackShell";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

export type DashboardFeatureScreenProps = NativeStackScreenProps<MenuStackParamList, "DashboardFeature">;

export function DashboardFeatureScreen({ route }: DashboardFeatureScreenProps) {
  const { t } = useAppTranslation();
  const { featureId, bookLessonTrainerId } = route.params;
  const { accountType } = useAuth();

  if (!isDashboardRouteAllowed(featureId, accountType)) {
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
      return wrap(<UpcomingSessionsScreen />);
    case "book-lesson":
      return wrap(<BookExpertScreen bookLessonTrainerId={bookLessonTrainerId} />);
    case "students":
      return wrap(<StudentsScreen />);
    case "friends":
      return wrap(<FriendsScreen />);
    case "my-community":
      return wrap(<CommunityScreen />);
    case "contact-us":
      return wrap(<ContactUsScreen />);
    case "about-us":
      return wrap(<AboutUsScreen />);
    case "faq":
      return wrap(<FaqScreen />);
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
