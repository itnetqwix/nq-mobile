import { useAuth } from "../context/AuthContext";

/** True when the user is exploring the app without signing in. */
export function useGuestMode(): boolean {
  const { status } = useAuth();
  return status === "signedOut";
}
