import React, { useCallback, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { SystemStateLayout } from "../components/SystemStateLayout";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useSystemState } from "./SystemStateContext";

type Props = {
  children: React.ReactNode;
};

/**
 * Global overlays: offline + maintenance. Session expired uses navigation
 * to SystemState screen instead of blocking the whole app.
 */
export function SystemGateProvider({ children }: Props) {
  const { offline } = useNetworkStatus();
  const { maintenanceMode } = useSystemState();
  const [retryKey, setRetryKey] = useState(0);

  const onRetry = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

  const showOffline = offline;
  const showMaintenance = maintenanceMode && !showOffline;

  return (
    <>
      <View style={styles.flex} key={retryKey}>
        {children}
      </View>
      <Modal
        visible={showOffline}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={onRetry}
      >
        <SystemStateLayout
          stateId="offline"
          showBrand
          actionContext={{ onRetry }}
        />
      </Modal>
      <Modal
        visible={showMaintenance}
        animationType="fade"
        presentationStyle="fullScreen"
      >
        <SystemStateLayout stateId="maintenance" showBrand />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
