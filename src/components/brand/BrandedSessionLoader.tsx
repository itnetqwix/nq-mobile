import React from "react";
import { NetQwixLoader } from "./NetQwixLoader";

/**
 * Full-screen loader while the app restores session or runs verification gate.
 */
export function BrandedSessionLoader() {
  return <NetQwixLoader message="Loading NetQwix" variant="fullscreen" size="lg" />;
}
