import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { useThemeColors } from "../../../theme";
import { WalletHomeScreen } from "../screens/WalletHomeScreen";
import { WalletTopUpScreen } from "../screens/WalletTopUpScreen";
import { WalletActivityScreen } from "../screens/WalletActivityScreen";
import { WalletSecurityScreen } from "../screens/WalletSecurityScreen";
import { SavedPaymentMethodsScreen } from "../screens/SavedPaymentMethodsScreen";
import { AutoTopUpScreen } from "../screens/AutoTopUpScreen";
import { StripeConnectOnboardingScreen } from "../screens/StripeConnectOnboardingScreen";
import { PointsActivityScreen } from "../../points/screens/PointsActivityScreen";
import { TransactionsScreen } from "../../dashboard/screens/TransactionsScreen";
import { useShellNestedBackRegistration } from "../../../navigation/ShellNestedBackContext";

export type WalletStackParamList = {
  WalletHome: undefined;
  WalletTopUp: { suggestedAmount?: number } | undefined;
  WalletActivity: undefined;
  WalletTransactions: undefined;
  WalletSecurity: undefined;
  WalletPaymentMethods: undefined;
  WalletAutoTopUp: undefined;
  PointsActivity: undefined;
  StripeConnect: undefined;
};

const Stack = createNativeStackNavigator<WalletStackParamList>();

type WalletNavigatorProps = {
  initialRouteName?: keyof WalletStackParamList;
  initialParams?: WalletStackParamList["WalletTopUp"];
};

function WalletStackInner({
  initialRouteName,
  initialParams,
}: WalletNavigatorProps) {
  const c = useThemeColors();
  useShellNestedBackRegistration();
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
      <Stack.Screen name="WalletTransactions" component={TransactionsScreen} />
      <Stack.Screen name="WalletSecurity" component={WalletSecurityScreen} />
      <Stack.Screen name="WalletPaymentMethods" component={SavedPaymentMethodsScreen} />
      <Stack.Screen name="WalletAutoTopUp" component={AutoTopUpScreen} />
      <Stack.Screen name="PointsActivity" component={PointsActivityScreen} />
      <Stack.Screen name="StripeConnect" component={StripeConnectOnboardingScreen} />
    </Stack.Navigator>
  );
}

export function WalletNavigator(props: WalletNavigatorProps = {}) {
  return <WalletStackInner {...props} />;
}
