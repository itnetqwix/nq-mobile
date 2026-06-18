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
import { TrainerEarningsScreen } from "../screens/TrainerEarningsScreen";
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
  TrainerEarnings: undefined;
};

const Stack = createNativeStackNavigator<WalletStackParamList>();

type WalletNavigatorProps = {
  initialRouteName?: keyof WalletStackParamList;
  initialParams?: WalletStackParamList["WalletTopUp"];
};

/** Registers wallet stack back handling from inside a screen so nested pops work. */
function withWalletNestedBack<P extends object>(Screen: React.ComponentType<P>) {
  function WalletScreenWithNestedBack(props: P) {
    useShellNestedBackRegistration();
    return <Screen {...props} />;
  }
  WalletScreenWithNestedBack.displayName = `WalletBack(${Screen.displayName ?? Screen.name ?? "Screen"})`;
  return WalletScreenWithNestedBack;
}

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
      <Stack.Screen name="WalletHome" component={withWalletNestedBack(WalletHomeScreen)} />
      <Stack.Screen
        name="WalletTopUp"
        component={withWalletNestedBack(WalletTopUpScreen)}
        initialParams={initialRouteName === "WalletTopUp" ? initialParams : undefined}
      />
      <Stack.Screen name="WalletActivity" component={withWalletNestedBack(WalletActivityScreen)} />
      <Stack.Screen name="WalletTransactions" component={withWalletNestedBack(TransactionsScreen)} />
      <Stack.Screen name="WalletSecurity" component={withWalletNestedBack(WalletSecurityScreen)} />
      <Stack.Screen name="WalletPaymentMethods" component={withWalletNestedBack(SavedPaymentMethodsScreen)} />
      <Stack.Screen name="WalletAutoTopUp" component={withWalletNestedBack(AutoTopUpScreen)} />
      <Stack.Screen name="PointsActivity" component={withWalletNestedBack(PointsActivityScreen)} />
      <Stack.Screen name="StripeConnect" component={withWalletNestedBack(StripeConnectOnboardingScreen)} />
      <Stack.Screen name="TrainerEarnings" component={withWalletNestedBack(TrainerEarningsScreen)} />
    </Stack.Navigator>
  );
}

export function WalletNavigator(props: WalletNavigatorProps = {}) {
  return <WalletStackInner {...props} />;
}
