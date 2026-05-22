import type { QueryClient } from "@tanstack/react-query";

let queryClient: QueryClient | null = null;

export function setGlobalQueryClient(client: QueryClient): void {
  queryClient = client;
}

export function getGlobalQueryClient(): QueryClient | null {
  return queryClient;
}
