import React, { useEffect, useState } from "react";
import { InteractionManager } from "react-native";
import { PushNotificationBridge } from "../features/notifications/PushNotificationBridge";
import { InstantLessonCallKeepBridge } from "../features/instant-lesson/InstantLessonCallKeepBridge";
import { TrainerOnlinePresenceBridge } from "../features/instant-lesson/TrainerOnlinePresenceBridge";
import { SessionLifecycleBridge } from "../features/sessions/SessionLifecycleBridge";
import { CmsLiveRefreshBridge } from "../features/content/CmsLiveRefreshBridge";
import { CoachMarkOverlay } from "../features/onboarding";
import { startNetInfoListener } from "../lib/network/netInfoBootstrap";

/**
 * Native bridges that are not needed for the first paint — mount after the
 * splash hands off to navigation to reduce cold-start crash risk on device.
 */
export function PostBootBridges() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    const backup = setTimeout(() => setReady(true), 600);
    return () => {
      task.cancel();
      clearTimeout(backup);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    return startNetInfoListener();
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <PushNotificationBridge />
      <InstantLessonCallKeepBridge />
      <TrainerOnlinePresenceBridge />
      <SessionLifecycleBridge />
      <CmsLiveRefreshBridge />
      <CoachMarkOverlay />
    </>
  );
}
