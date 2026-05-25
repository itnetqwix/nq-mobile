import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "nq-react-query",
});

export function createPersistedQueryClient(): QueryClient {
  /**
   * Default cache policy for the mobile app:
   *
   *  • `staleTime: 60s` — most lists tolerate a minute of staleness
   *    and refetching on every screen focus is wasteful on a phone
   *    radio. Per-screen overrides are still allowed where the data
   *    truly needs to be live (chat, presence, balance).
   *  • `refetchOnWindowFocus: false` — RN already pulls fresh data
   *    via `useFocusEffect` / sockets; the additional focus refetch
   *    just doubles the request count.
   *  • `refetchOnReconnect: true` — when we come back online we
   *    *do* want a fresh pull (the network banner already signaled
   *    that we were stale).
   */
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 60_000,
        gcTime: PERSIST_MAX_AGE_MS,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: false,
      },
    },
  });
}

export { persister, PERSIST_MAX_AGE_MS, PersistQueryClientProvider };
