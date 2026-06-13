import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { Modal, StyleSheet, View } from "react-native";
import { NetQwixLoader } from "./NetQwixLoader";
import { warmLoaderTipsCache } from "./loaderTips/loaderTipsService";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  setLoaderMessage,
  setLoaderVisible,
} from "../../store/slices/uiSlice";
import { selectLoaderMessage, selectLoaderVisible } from "../../store/selectors";

const SHOW_DELAY_MS = 280;

type LoaderContextValue = {
  showLoader: (message?: string) => void;
  hideLoader: () => void;
  isLoading: boolean;
};

const LoaderContext = createContext<LoaderContextValue | null>(null);

export function LoaderProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const visible = useAppSelector(selectLoaderVisible);
  const message = useAppSelector(selectLoaderMessage);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const showLoader = useCallback(
    (msg?: string) => {
      if (msg) dispatch(setLoaderMessage(msg));
      pendingRef.current = true;
      clearShowTimer();
      showTimerRef.current = setTimeout(() => {
        showTimerRef.current = null;
        if (pendingRef.current) dispatch(setLoaderVisible(true));
      }, SHOW_DELAY_MS);
    },
    [clearShowTimer, dispatch]
  );

  const hideLoader = useCallback(() => {
    pendingRef.current = false;
    clearShowTimer();
    dispatch(setLoaderVisible(false));
  }, [clearShowTimer, dispatch]);

  useEffect(() => {
    warmLoaderTipsCache();
    return () => clearShowTimer();
  }, [clearShowTimer]);

  const value = useMemo(
    () => ({ showLoader, hideLoader, isLoading: visible }),
    [showLoader, hideLoader, visible]
  );

  return (
    <LoaderContext.Provider value={value}>
      {children}
      <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalRoot}>
          <NetQwixLoader
            message={message}
            variant="fullscreen"
            size="md"
            motion="quick"
            backdrop="solid"
            showTips
          />
        </View>
      </Modal>
    </LoaderContext.Provider>
  );
}

export function useLoader(): LoaderContextValue {
  const ctx = useContext(LoaderContext);
  if (!ctx) {
    throw new Error("useLoader must be used within LoaderProvider");
  }
  return ctx;
}

export function useLoaderOptional(): LoaderContextValue | null {
  return useContext(LoaderContext);
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
});
