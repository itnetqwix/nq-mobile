import { useNavigation } from "@react-navigation/native";
import React, { useEffect } from "react";
import {
  clearShellNestedBackHandlers,
  registerShellNestedBackHandler,
  tryShellNestedBack,
} from "./shellNestedBackRegistry";

export { tryShellNestedBack };

/**
 * Clears nested handlers when a shell surface unmounts.
 * The header (`AppScreenHeader`) renders outside this tree, so handlers
 * live in `shellNestedBackRegistry` where both header and content can reach them.
 */
export function ShellNestedBackProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => () => clearShellNestedBackHandlers(), []);
  return <>{children}</>;
}

/**
 * Registers an inner navigator (wallet stack, etc.) so the shell header back
 * button pops one inner frame before exiting the shell.
 */
export function useShellNestedBackRegistration() {
  const navigation = useNavigation();

  useEffect(() => {
    const handler = {
      canGoBack: () => navigation.canGoBack(),
      goBack: () => navigation.goBack(),
    };
    return registerShellNestedBackHandler(handler);
  }, [navigation]);
}

/** HOC for screens hosted inside a nested stack within a shell surface. */
export function withShellNestedBack<P extends object>(Screen: React.ComponentType<P>) {
  function ScreenWithShellNestedBack(props: P) {
    useShellNestedBackRegistration();
    return <Screen {...props} />;
  }
  ScreenWithShellNestedBack.displayName = `ShellBack(${Screen.displayName ?? Screen.name ?? "Screen"})`;
  return ScreenWithShellNestedBack;
}
