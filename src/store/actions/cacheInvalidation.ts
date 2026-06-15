import { createAction } from "@reduxjs/toolkit";

/** Dispatched when the server pushes a socket event that may stale React Query caches. */
export const socketCacheEvent = createAction<{ event: string; payload?: unknown }>(
  "cacheInvalidation/socketEvent"
);

/** User completed sign-in or token refresh with profile loaded. */
export const userSignedIn = createAction("cacheInvalidation/userSignedIn");

/** User signed out — listener may clear persisted query cache. */
export const userSignedOut = createAction("cacheInvalidation/userSignedOut");

/** Locker clips / reports / saved sessions changed locally. */
export const lockerMutated = createAction("cacheInvalidation/lockerMutated");

/** Socket (re)connected — refresh session and presence lists. */
export const socketReconnected = createAction("cacheInvalidation/socketReconnected");
