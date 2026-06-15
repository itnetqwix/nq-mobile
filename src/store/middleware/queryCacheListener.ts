import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import { fetchMasterRow } from "../../features/auth/api/masterApi";
import {
  invalidateForSocketEvent,
  invalidateLocker,
  invalidateOnSocketReconnect,
} from "../../lib/queryInvalidation";
import { queryKeys } from "../../lib/queryKeys";
import { getGlobalQueryClient } from "../queryClientRef";
import {
  lockerMutated,
  socketCacheEvent,
  userSignedIn,
  userSignedOut,
} from "../actions/cacheInvalidation";
import { setSocketConnected } from "../slices/socketSlice";
import {
  clearSessionLocalThunk,
  completeSessionFromTokens,
  hydrateAuth,
  signOutThunk,
} from "../slices/authSlice";

export const queryCacheListener = createListenerMiddleware();

/** Skip reconnect refresh on the first socket connect — home queries already mount-fetch. */
let hadSocketConnectionBefore = false;

function qc() {
  return getGlobalQueryClient();
}

queryCacheListener.startListening({
  actionCreator: socketCacheEvent,
  effect: ({ payload }) => {
    const client = qc();
    if (!client || !payload?.event) return;
    invalidateForSocketEvent(client, payload.event, payload.payload);
  },
});

queryCacheListener.startListening({
  actionCreator: lockerMutated,
  effect: () => {
    const client = qc();
    if (!client) return;
    invalidateLocker(client);
  },
});

queryCacheListener.startListening({
  matcher: isAnyOf(userSignedIn, completeSessionFromTokens.fulfilled, hydrateAuth.fulfilled),
  effect: (action) => {
    if (hydrateAuth.fulfilled.match(action) && action.payload.signedIn === false) return;
    const client = qc();
    if (!client) return;
    void client.prefetchQuery({
      queryKey: queryKeys.master.row,
      queryFn: fetchMasterRow,
      staleTime: 300_000,
    });
  },
});

queryCacheListener.startListening({
  matcher: isAnyOf(userSignedOut, signOutThunk.fulfilled, clearSessionLocalThunk.fulfilled),
  effect: () => {
    hadSocketConnectionBefore = false;
    /** signOutThunk already calls clear(); listener is a safety net for other sign-out paths. */
    qc()?.clear();
  },
});

queryCacheListener.startListening({
  actionCreator: setSocketConnected,
  effect: (action) => {
    if (!action.payload) return;
    if (!hadSocketConnectionBefore) {
      hadSocketConnectionBefore = true;
      return;
    }
    const client = qc();
    if (!client) return;
    invalidateOnSocketReconnect(client);
  },
});
