import React from "react";
import { View, type ViewProps } from "react-native";
import { webHomeStyles } from "./webHomeStyles";

type Props = {
  children: React.ReactNode;
  style?: ViewProps["style"];
  testID?: string;
};

/**
 * Web: `.Trainer-box-1.card-body` — used for online coach tiles (`UserInfoCard` / banner cards).
 */
export function TrainerBoxCard({ children, style, testID }: Props) {
  return (
    <View style={[webHomeStyles.trainerBox1, style]} testID={testID ?? "Trainer-box-1 card-body"}>
      {children}
    </View>
  );
}
