import { useEffect, useState } from "react";
import {
  isInstantLessonCallKeepReady,
  subscribeInstantLessonCallKeepReady,
} from "./instantLessonCallKeep";

/** True when CallKit / ConnectionService handles incoming UI instead of the in-app overlay. */
export function useNativeIncomingCallUi(): boolean {
  const [ready, setReady] = useState(isInstantLessonCallKeepReady());

  useEffect(() => {
    setReady(isInstantLessonCallKeepReady());
    return subscribeInstantLessonCallKeepReady(() => {
      setReady(isInstantLessonCallKeepReady());
    });
  }, []);

  return ready;
}
