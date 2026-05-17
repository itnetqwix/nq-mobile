import React from "react";
import { StyleSheet, Text, View, type ViewProps } from "react-native";
import { useWebHomeStyles } from "./webHomeStyles";

type Props = {
  title?: string;
  children: React.ReactNode;
  /** Mirrors web class names for QA / future Maestro tests */
  testID?: string;
  bodyStyle?: ViewProps["style"];
};

/**
 * Web: `div.card.trainer-profile-card.Home-main-Cont` + inner `card-body`
 * (see `NavHomePage/index.jsx` — friend requests, trainer profile, etc.)
 */
export function HomeMainCont({ title, children, testID, bodyStyle }: Props) {
  const webHomeStyles = useWebHomeStyles();
  return (
    <View style={webHomeStyles.homeMainCont} testID={testID}>
      <View style={[webHomeStyles.homeMainContBody, bodyStyle]}>
        {!!title && <Text style={webHomeStyles.homeMainTitle}>{title}</Text>}
        {children}
      </View>
    </View>
  );
}
