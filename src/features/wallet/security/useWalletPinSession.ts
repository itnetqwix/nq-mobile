import { useCallback, useEffect, useState } from "react";
import { getPinSessionToken, isPinSessionValid } from "./pinSessionStore";

export function useWalletPinSession() {
  const [valid, setValid] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const t = await getPinSessionToken();
    setToken(t);
    setValid(!!t);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { pinSessionValid: valid, pinSessionToken: token, refreshPinSession: refresh };
}

export async function requireValidPinSession(): Promise<string | null> {
  if (await isPinSessionValid()) {
    return getPinSessionToken();
  }
  return null;
}
