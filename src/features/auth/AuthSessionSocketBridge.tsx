/**
 * Signs the user out when another device revokes this auth session (multi-device policy).
 * If a lesson call is active, ends the call gracefully first.
 */

import { useEffect } from "react";
import { Alert } from "react-native";
import { useAuth } from "./context/AuthContext";
import { getSessionId } from "./session/tokenStorage";
import { useSocket } from "../socket/SocketContext";
import { getActiveCall } from "../calling/activeCallRegistry";

export function AuthSessionSocketBridge() {
  const { signOut } = useAuth();
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const onRevoked = async (payload: {
      sessionIds?: string[];
      reason?: string;
    }) => {
      const mine = await getSessionId();
      const ids = (payload?.sessionIds ?? []).map(String);
      if (!mine || !ids.includes(String(mine))) return;

      const activeCall = getActiveCall();
      const inLesson = activeCall != null;

      Alert.alert(
        inLesson ? "Lesson ended" : "Signed out",
        inLesson
          ? "Your account was signed in elsewhere or this session was revoked. The lesson will end and you will be signed out."
          : "This device was signed out because your account was used on another device or a session was revoked.",
        [
          {
            text: "OK",
            onPress: () => {
              try {
                activeCall?.onForceEnd?.();
              } catch {
                /* non-fatal */
              }
              void signOut();
            },
          },
        ]
      );
    };

    socket.on("AUTH_SESSION_REVOKED", onRevoked);
    return () => {
      socket.off("AUTH_SESSION_REVOKED", onRevoked);
    };
  }, [signOut, socket]);

  return null;
}
