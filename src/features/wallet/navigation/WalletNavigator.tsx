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
        headerTintColor: c.headerTint,
        headerTitleStyle: { fontWeight: "600", color: c.headerTitle },
        headerStyle: { backgroundColor: c.background },
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Screen name="WalletHome" component={WalletHomeScreen} options={{ title: "Wallet" }} />
      <Stack.Screen
        name="WalletTopUp"
        component={WalletTopUpScreen}
        initialParams={initialRouteName === "WalletTopUp" ? initialParams : undefined}
        options={{ title: "Add funds" }}
      />
      <Stack.Screen
        name="WalletActivity"
        component={WalletActivityScreen}
        options={{ title: "Activity" }}
      />
      <Stack.Screen
        name="WalletSecurity"
        component={WalletSecurityScreen}
        options={{ title: "Security" }}
      />
    </Stack.Navigator>
  );
}
