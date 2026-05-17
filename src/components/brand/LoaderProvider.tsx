import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Modal, StyleSheet, View } from "react-native";
import { NetQwixLoader } from "./NetQwixLoader";
import { warmLoaderTipsCache } from "./loaderTips/loaderTipsService";

/** Avoid flashing the overlay on fast sign-in / API calls. */
const SHOW_DELAY_MS = 280;

type LoaderContextValue = {
  showLoader: (message?: string) => void;
  hideLoader: () => void;
  isLoading: boolean;
};

const LoaderContext = createContext<LoaderContextValue | null>(null);

export function LoaderProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("Loading");
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
      if (msg) setMessage(msg);
      pendingRef.current = true;
      clearShowTimer();
      showTimerRef.current = setTimeout(() => {
        showTimerRef.current = null;
        if (pendingRef.current) setVisible(true);
      }, SHOW_DELAY_MS);
    },
    [clearShowTimer]
  );

  const hideLoader = useCallback(() => {
    pendingRef.current = false;
    clearShowTimer();
    setVisible(false);
  }, [clearShowTimer]);

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
            variant="overlay"
            size="md"
            motion="quick"
            backdrop="scrim"
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

/** Safe hook when provider may be absent (e.g. tests). */
export function useLoaderOptional(): LoaderContextValue | null {
  return useContext(LoaderContext);
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
});
