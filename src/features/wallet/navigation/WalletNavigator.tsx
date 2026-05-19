import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { useThemeColors } from "../../../theme";
import { WalletHomeScreen } from "../screens/WalletHomeScreen";
import { WalletTopUpScreen } from "../screens/WalletTopUpScreen";
import { WalletActivityScreen } from "../screens/WalletActivityScreen";
import { WalletSecurityScreen } from "../screens/WalletSecurityScreen";

export type WalletStackParamList = {
  WalletHome: undefined;
  WalletTopUp: { suggestedAmount?: number } | undefined;
  WalletActivity: undefined;
  WalletSecurity: undefined;
};

const Stack = createNativeStackNavigator<WalletStackParamList>();

type WalletNavigatorProps = {
  initialRouteName?: keyof WalletStackParamList;
  initialParams?: WalletStackParamList["WalletTopUp"];
};

export function WalletNavigator({
  initialRouteName,
  initialParams,
}: WalletNavigatorProps = {}) {
  const c = useThemeColors();
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName ?? "WalletHome"}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Screen name="WalletHome" component={WalletHomeScreen} />
      <Stack.Screen
        name="WalletTopUp"
        component={WalletTopUpScreen}
        initialParams={initialRouteName === "WalletTopUp" ? initialParams : undefined}
      />
      <Stack.Screen name="WalletActivity" component={WalletActivityScreen} />
      <Stack.Screen name="WalletSecurity" component={WalletSecurityScreen} />
    </Stack.Navigator>
  );
}
