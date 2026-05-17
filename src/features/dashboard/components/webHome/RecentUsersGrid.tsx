import React from "react";
import { ScrollView, View } from "react-native";
import { useWebHomeStyles } from "./webHomeStyles";

type Props = {
  /** Web: trainer → `trainer-students-grid`; trainee → `single-row-experts` */
  accountIsTrainer: boolean;
  children: React.ReactNode;
};

/**
 * Web: `recent-users-grid` + `trainer-students-grid` | `single-row-experts`
 * (`app/components/recent-users/index.jsx`)
 */
export function RecentUsersGrid({ accountIsTrainer, children }: Props) {
  const webHomeStyles = useWebHomeStyles();
  if (accountIsTrainer) {
    return (
      <View
        style={webHomeStyles.recentUsersGridTrainer}
        testID="recent-users-grid trainer-students-grid"
      >
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={webHomeStyles.recentUsersRowTrainee}
      testID="recent-users-grid single-row-experts"
    >
      {children}
    </ScrollView>
  );
}
