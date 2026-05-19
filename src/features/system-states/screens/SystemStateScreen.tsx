import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import type { RootStackParamList } from "../../../navigation/types";
import { SystemStateLayout } from "../components/SystemStateLayout";

type Props = NativeStackScreenProps<RootStackParamList, "SystemState">;

export function SystemStateScreen({ route, navigation }: Props) {
  const { stateId, message } = route.params;
  const [busy, setBusy] = useState(false);

  const onRetry = useCallback(() => {
    setBusy(true);
    navigation.goBack();
    setBusy(false);
  }, [navigation]);

  const onDismiss = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  return (
    <SystemStateLayout
      stateId={stateId}
      description={message}
      actionContext={{ onRetry, onDismiss }}
      busy={busy}
    />
  );
}
