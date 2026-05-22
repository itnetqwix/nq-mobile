import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import type { SystemStateId } from "../presets/types";
import { navigateToSystemState } from "../navigation/linkActions";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { setMaintenanceMode } from "../../../store/slices/systemSlice";
import { selectMaintenanceMode } from "../../../store/selectors";

type SystemStateContextValue = {
  showSystemState: (id: SystemStateId, message?: string) => void;
  maintenanceMode: boolean;
  setMaintenanceMode: (on: boolean) => void;
};

const SystemStateContext = createContext<SystemStateContextValue | null>(null);

export function SystemStateProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const maintenanceMode = useAppSelector(selectMaintenanceMode);

  const showSystemState = useCallback((id: SystemStateId, message?: string) => {
    navigateToSystemState(id, { message });
  }, []);

  const setMaintenanceModeLocal = useCallback(
    (on: boolean) => {
      dispatch(setMaintenanceMode(on));
    },
    [dispatch]
  );

  const value = useMemo(
    () => ({
      showSystemState,
      maintenanceMode,
      setMaintenanceMode: setMaintenanceModeLocal,
    }),
    [showSystemState, maintenanceMode, setMaintenanceModeLocal]
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

export function useSystemStateOptional(): SystemStateContextValue | null {
  return useContext(SystemStateContext);
}
