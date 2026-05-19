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

export type DashboardFeatureScreenProps = NativeStackScreenProps<MenuStackParamList, "DashboardFeature">;

export function DashboardFeatureScreen({ route }: DashboardFeatureScreenProps) {
  const { featureId, bookLessonTrainerId } = route.params;
  const { accountType } = useAuth();

  if (!isDashboardRouteAllowed(featureId, accountType)) {
    return (
      <EmptyState
        icon="lock-closed-outline"
        title="Not available"
        description="This section is only available for trainee accounts."
      />
    );
  }

  switch (featureId) {
    case "upcoming-sessions":
      return <UpcomingSessionsScreen />;
    case "book-lesson":
      return <BookExpertScreen bookLessonTrainerId={bookLessonTrainerId} />;
    case "students":
      return <StudentsScreen />;
    case "friends":
      return <FriendsScreen />;
    case "my-community":
      return <CommunityScreen />;
    case "contact-us":
      return <ContactUsScreen />;
    case "about-us":
      return <AboutUsScreen />;
    case "faq":
      return <FaqScreen />;
    case "meeting-room":
      return <MeetingRoomScreen />;
    case "practice-session":
      return <PracticeSessionScreen />;
    case "instant-booking":
      return <InstantBookingScreen />;
    default:
      return null;
  }
}
