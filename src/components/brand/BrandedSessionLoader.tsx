import React, { useEffect } from "react";
import { NetQwixLoader } from "./NetQwixLoader";
import { warmLoaderTipsCache } from "./loaderTips/loaderTipsService";

/**
 * Full-screen loader while the app restores session or runs verification gate.
 */
export function BrandedSessionLoader() {
  useEffect(() => {
    warmLoaderTipsCache();
  }, []);

  return (
    <NetQwixLoader
      message=""
      variant="fullscreen"
      size="md"
      motion="quick"
      backdrop="scrim"
      showTips
    />
  );
}
