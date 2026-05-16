import React, { useEffect, useState } from "react";
import { NetQwixLoader } from "../../../components/brand/NetQwixLoader";
import { requireAppUnlock } from "../security/appUnlock";

type Props = {
  children: React.ReactNode;
};

export function AppUnlockGate({ children }: Props) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await requireAppUnlock();
      if (cancelled) return;
      if (!ok) {
        setFailed(true);
        return;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return <NetQwixLoader message="Unlock to continue" variant="fullscreen" />;
  }

  if (!ready) {
    return <NetQwixLoader message="Unlocking…" variant="fullscreen" />;
  }

  return <>{children}</>;
}
