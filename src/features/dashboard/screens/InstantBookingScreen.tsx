import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, space } from "../../../theme/tokens";
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";
import { useQuery } from "@tanstack/react-query";
import { fetchScheduledMeetings } from "../../home/api/homeApi";
import { UpcomingSessionsScreen } from "../../sessions/screens/UpcomingSessionsScreen";

const NAVY = "#000080";

export function InstantBookingScreen() {
  const { accountType } = useAuth();
  // Instant booking shows active sessions & quick actions — same as web locker home
  return <UpcomingSessionsScreen />;
}
