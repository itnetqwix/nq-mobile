import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { withShellNestedBack } from "../../../navigation/ShellNestedBackContext";
import { useThemeColors } from "../../../theme";
import { WalletHomeScreen } from "../screens/WalletHomeScreen";
import { WalletTopUpScreen } from "../screens/WalletTopUpScreen";
import { WalletActivityScreen } from "../screens/WalletActivityScreen";
import { WalletSecurityScreen } from "../screens/WalletSecurityScreen";
import { SavedPaymentMethodsScreen } from "../screens/SavedPaymentMethodsScreen";
import { AutoTopUpScreen } from "../screens/AutoTopUpScreen";
import { StripeConnectOnboardingScreen } from "../screens/StripeConnectOnboardingScreen";
import { TrainerEarningsScreen } from "../screens/TrainerEarningsScreen";
import { PointsActivityScreen } from "../../points/screens/PointsActivityScreen";
import { TransactionsScreen } from "../../dashboard/screens/TransactionsScreen";

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
  TrainerEarnings: undefined;
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
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName ?? "WalletHome"}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Screen name="WalletHome" component={withShellNestedBack(WalletHomeScreen)} />
      <Stack.Screen
        name="WalletTopUp"
        component={withShellNestedBack(WalletTopUpScreen)}
        initialParams={initialRouteName === "WalletTopUp" ? initialParams : undefined}
      />
      <Stack.Screen name="WalletActivity" component={withShellNestedBack(WalletActivityScreen)} />
      <Stack.Screen name="WalletTransactions" component={withShellNestedBack(TransactionsScreen)} />
      <Stack.Screen name="WalletSecurity" component={withShellNestedBack(WalletSecurityScreen)} />
      <Stack.Screen name="WalletPaymentMethods" component={withShellNestedBack(SavedPaymentMethodsScreen)} />
      <Stack.Screen name="WalletAutoTopUp" component={withShellNestedBack(AutoTopUpScreen)} />
      <Stack.Screen name="PointsActivity" component={withShellNestedBack(PointsActivityScreen)} />
      <Stack.Screen name="StripeConnect" component={withShellNestedBack(StripeConnectOnboardingScreen)} />
      <Stack.Screen name="TrainerEarnings" component={withShellNestedBack(TrainerEarningsScreen)} />
    </Stack.Navigator>
  );
}

export function WalletNavigator(props: WalletNavigatorProps = {}) {
  return <WalletStackInner {...props} />;
}
