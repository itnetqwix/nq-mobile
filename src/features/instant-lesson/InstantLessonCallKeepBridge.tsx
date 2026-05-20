/**
 * Sets up CallKeep and routes system Accept / Decline to InstantLessonContext.
 * Mount only for signed-in trainers inside a dev build.
 */

import { useEffect } from "react";
import { Platform } from "react-native";
import { useAuth } from "../auth/context/AuthContext";
import { AccountType } from "../../constants/accountType";
import {
  getInstantLessonActionHandlers,
  type InstantLessonIncomingPayload,
} from "./instantLessonBridge";
import {
  displayInstantLessonIncomingCall,
  endInstantLessonCall,
  getCallKeepModule,
  getPayloadForCallUuid,
  markCallUuidAnswered,
  setupInstantLessonCallKeep,
  wasCallUuidAnswered,
} from "./instantLessonCallKeep";
import { dismissInstantLessonIncomingCall } from "./instantLessonIncomingNotifications";

type CallKeepEvent = { name: string; data?: { callUUID?: string; handle?: string } };

export function InstantLessonCallKeepBridge() {
  const { status, accountType } = useAuth();
  const isTrainer = accountType === AccountType.TRAINER && status === "signedIn";

  useEffect(() => {
    if (!isTrainer || Platform.OS === "web") return;

    let cancelled = false;
    const subscriptions: { remove: () => void }[] = [];

    void (async () => {
      const ready = await setupInstantLessonCallKeep();
      if (!ready || cancelled) return;

      const ck = getCallKeepModule();
      if (!ck) return;

      const handleAnswer = async (callUUID: string) => {
        const payload = getPayloadForCallUuid(callUUID);
        if (!payload) return;

        markCallUuidAnswered(callUUID);
        const handlers = getInstantLessonActionHandlers();
        if (handlers.acceptIncoming) {
          await handlers.acceptIncoming(payload);
        }
        await dismissInstantLessonIncomingCall(payload.lessonId);
        await endInstantLessonCall(payload.lessonId);
        if (Platform.OS === "android") {
          try {
            await ck.backToForeground();
          } catch {
            /* ignore */
          }
        }
      };

      const handleEnd = async (callUUID: string) => {
        if (wasCallUuidAnswered(callUUID)) {
          const payload = getPayloadForCallUuid(callUUID);
          if (payload) await endInstantLessonCall(payload.lessonId);
          return;
        }

        const payload = getPayloadForCallUuid(callUUID);
        if (!payload) return;

        const handlers = getInstantLessonActionHandlers();
        if (handlers.declineIncoming) {
          await handlers.declineIncoming(payload.lessonId);
        }
        await dismissInstantLessonIncomingCall(payload.lessonId);
        await endInstantLessonCall(payload.lessonId);
      };

      const replayInitialEvents = (events: CallKeepEvent[]) => {
        for (const event of events) {
          const callUUID = event.data?.callUUID;
          if (!callUUID) continue;
          if (event.name === "answerCall") {
            void handleAnswer(callUUID);
          } else if (event.name === "endCall") {
            void handleEnd(callUUID);
          }
        }
      };

      try {
        const initial = await ck.getInitialEvents();
        if (Array.isArray(initial) && initial.length > 0) {
          replayInitialEvents(initial as CallKeepEvent[]);
          ck.clearInitialEvents();
        }
      } catch {
        /* older native builds */
      }

      subscriptions.push(
        ck.addEventListener("answerCall", ({ callUUID }: { callUUID: string }) => {
          void handleAnswer(callUUID);
        })
      );

      subscriptions.push(
        ck.addEventListener("endCall", ({ callUUID }: { callUUID: string }) => {
          void handleEnd(callUUID);
        })
      );

      subscriptions.push(
        ck.addEventListener("didLoadWithEvents", (events: CallKeepEvent[]) => {
          replayInitialEvents(events);
        })
      );
    })();

    return () => {
      cancelled = true;
      subscriptions.forEach((s) => s.remove());
    };
  }, [isTrainer]);

  return null;
}

/** Called from InstantLessonContext when a request arrives (socket or push). */
export async function presentNativeInstantLessonIncoming(
  payload: InstantLessonIncomingPayload
): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const ready = await setupInstantLessonCallKeep();
  if (!ready) return false;
  return displayInstantLessonIncomingCall(payload);
}
