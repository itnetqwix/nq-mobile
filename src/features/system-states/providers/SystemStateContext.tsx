import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { SystemStateId } from "../presets/types";
import { navigateToSystemState } from "../navigation/linkActions";

type SystemStateContextValue = {
  showSystemState: (id: SystemStateId, message?: string) => void;
  /** Force global maintenance overlay (e.g. from env). */
  maintenanceMode: boolean;
  setMaintenanceMode: (on: boolean) => void;
};

const SystemStateContext = createContext<SystemStateContextValue | null>(null);

export function SystemStateProvider({ children }: { children: React.ReactNode }) {
  const [maintenanceMode, setMaintenanceMode] = useState(
    process.env.EXPO_PUBLIC_MAINTENANCE_MODE === "1"
  );

  const showSystemState = useCallback((id: SystemStateId, message?: string) => {
    navigateToSystemState(id, { message });
  }, []);

  const value = useMemo(
    () => ({
      showSystemState,
      maintenanceMode,
      setMaintenanceMode,
    }),
    [showSystemState, maintenanceMode]
  );

  return (
    <SystemStateContext.Provider value={value}>
      {children}
    </SystemStateContext.Provider>
  );
}

export function useSystemState(): SystemStateContextValue {
  const ctx = useContext(SystemStateContext);
  if (!ctx) {
    throw new Error("useSystemState must be used within SystemStateProvider");
  }
  return ctx;
}

/** Safe when provider is optional (e.g. tests). */
export function useSystemStateOptional(): SystemStateContextValue | null {
  return useContext(SystemStateContext);
}
