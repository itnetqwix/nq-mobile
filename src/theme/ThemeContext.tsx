/**
 * Theme mode context — wraps the app and exposes a stable `mode` plus a setter
 * so Settings can flip between "light", "dark", and "system". The active
 * `colors` palette is derived from the resolved scheme.
 *
 * Persistence is best-effort via `AsyncStorage`; the in-memory state is the
 * source of truth.
 */

import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import { type AppColors, resolveColors } from "./index";

export type ThemeMode = "system" | "light" | "dark";

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (next: ThemeMode) => void;
  /** Resolved (light/dark) — what the UI should actually use. */
  scheme: "light" | "dark";
  colors: AppColors;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
/** `expo-secure-store` only allows `[A-Za-z0-9._-]`. */
const STORAGE_KEY = "nq.theme-mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (!cancelled && raw && (raw === "light" || raw === "dark" || raw === "system")) {
          setModeState(raw as ThemeMode);
        }
      } catch {
        /* non-blocking */
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    /** Fire-and-forget persistence. */
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => undefined);
  };

  const scheme: "light" | "dark" =
    mode === "system" ? (system === "dark" ? "dark" : "light") : mode;

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, setMode, scheme, colors: resolveColors(scheme) }),
    [mode, scheme]
  );

  /** Don't block render on hydration — first paint uses the default ("system"). */
  void hydrated;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    /** Sensible default for tests / preview render. */
    return {
      mode: "system",
      setMode: () => undefined,
      scheme: "light",
      colors: resolveColors("light"),
    };
  }
  return ctx;
}
