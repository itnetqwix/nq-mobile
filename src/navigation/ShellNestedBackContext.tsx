import { useNavigation } from "@react-navigation/native";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

type NestedBackHandler = {
  canGoBack: () => boolean;
  goBack: () => void;
};

type ShellNestedBackContextValue = {
  register: (handler: NestedBackHandler) => () => void;
  tryGoBack: () => boolean;
};

const ShellNestedBackContext = createContext<ShellNestedBackContextValue | null>(null);

/** Wrap shell surfaces that host an inner stack (e.g. wallet). */
export function ShellNestedBackProvider({ children }: { children: React.ReactNode }) {
  const handlerRef = useRef<NestedBackHandler | null>(null);

  const register = useCallback((handler: NestedBackHandler) => {
    handlerRef.current = handler;
    return () => {
      if (handlerRef.current === handler) {
        handlerRef.current = null;
      }
    };
  }, []);

  const tryGoBack = useCallback(() => {
    const handler = handlerRef.current;
    if (handler?.canGoBack()) {
      handler.goBack();
      return true;
    }
    return false;
  }, []);

  const value = useMemo(() => ({ register, tryGoBack }), [register, tryGoBack]);

  return (
    <ShellNestedBackContext.Provider value={value}>{children}</ShellNestedBackContext.Provider>
  );
}

export function useShellNestedBack() {
  return useContext(ShellNestedBackContext);
}

/**
 * Registers an inner navigator (wallet stack, etc.) so the parent shell
 * header back button pops one inner frame before exiting the shell.
 */
export function useShellNestedBackRegistration() {
  const ctx = useShellNestedBack();
  const navigation = useNavigation();

  useEffect(() => {
    if (!ctx) return undefined;

    const handler: NestedBackHandler = {
      canGoBack: () => navigation.canGoBack(),
      goBack: () => navigation.goBack(),
    };

    return ctx.register(handler);
  }, [ctx, navigation]);
}
