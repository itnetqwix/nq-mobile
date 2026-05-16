import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { useThemeColors } from "../../../theme";
import { WalletHomeScreen } from "../screens/WalletHomeScreen";
import { WalletTopUpScreen } from "../screens/WalletTopUpScreen";
import { WalletActivityScreen } from "../screens/WalletActivityScreen";
import { WalletSecurityScreen } from "../screens/WalletSecurityScreen";

export type WalletStackParamList = {
  WalletHome: undefined;
  WalletTopUp: undefined;
  WalletActivity: undefined;
  WalletSecurity: undefined;
};

const Stack = createNativeStackNavigator<WalletStackParamList>();

export function WalletNavigator() {
  const c = useThemeColors();
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: c.headerTint,
        headerTitleStyle: { fontWeight: "600", color: c.headerTitle },
        headerStyle: { backgroundColor: c.background },
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Screen name="WalletHome" component={WalletHomeScreen} options={{ title: "Wallet" }} />
      <Stack.Screen name="WalletTopUp" component={WalletTopUpScreen} options={{ title: "Add funds" }} />
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
