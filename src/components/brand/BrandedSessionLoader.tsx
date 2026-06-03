import React from "react";
import { BrandBootScreen } from "../splash/BrandBootScreen";

/**
 * Full-screen loader while the app restores session or runs verification gate.
 * Matches cold-start splash for a consistent, minimal boot experience.
 */
export function BrandedSessionLoader() {
  return <BrandBootScreen />;
}
