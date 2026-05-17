import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Modal, StyleSheet, View } from "react-native";
import { NetQwixLoader } from "./NetQwixLoader";

type LoaderContextValue = {
  showLoader: (message?: string) => void;
  hideLoader: () => void;
  isLoading: boolean;
};

const LoaderContext = createContext<LoaderContextValue | null>(null);

export function LoaderProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("Loading");

  const showLoader = useCallback((msg?: string) => {
    if (msg) setMessage(msg);
    setVisible(true);
  }, []);

  const hideLoader = useCallback(() => {
    setVisible(false);
  }, []);

  const value = useMemo(
    () => ({ showLoader, hideLoader, isLoading: visible }),
    [showLoader, hideLoader, visible]
  );

  return (
    <LoaderContext.Provider value={value}>
      {children}
      <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
        <View style={styles.modalRoot}>
          <NetQwixLoader message={message} variant="overlay" size="lg" />
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
