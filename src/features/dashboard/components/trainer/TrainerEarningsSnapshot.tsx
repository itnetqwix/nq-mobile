import React from "react";
import { StyleSheet, View } from "react-native";
import { space } from "../../../../theme";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../../lib/queryKeys";
import { fetchTrainerEarnings } from "../../../wallet/walletApi";
import { DashboardStatChip } from "../shared/DashboardStatChip";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { computeTrainerEarningsDisplay } from "./trainerEarningsDisplayLogic";

type Props = {
  onPress?: () => void;
};

export function TrainerEarningsSnapshot({ onPress }: Props) {
  const { t } = useAppTranslation();
  const { data: earnings } = useQuery({
    queryKey: queryKeys.wallet.earnings,
    queryFn: fetchTrainerEarnings,
    staleTime: 120_000,
  });

  const { available, pending, showPending, availableLabel, pendingLabel } =
    computeTrainerEarningsDisplay(earnings?.balances);

  return (
    <View style={styles.row}>
      <DashboardStatChip
        icon="cash-outline"
        label={t("trainerDashboard.earningsAvailable")}
        value={availableLabel}
        onPress={onPress}
        tone="success"
        expand
        accessibilityLabel={t("trainerDashboard.earningsA11y")}
      />
      {showPending ? (
        <DashboardStatChip
          icon="time-outline"
          label={t("trainerDashboard.earningsPending")}
          value={pendingLabel}
          expand
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.sm },
});
