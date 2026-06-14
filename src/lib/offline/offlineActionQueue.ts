/**
 * Generic offline retry queue (MMKV-backed).
 * Specialized queues register executors by `kind` and share one flush loop.
 */

import { useEffect } from "react";
import {
  isNetworkOnline,
  useNetworkOnline,
} from "../networkStatusStore";
import { readJsonFromMmkv, writeJsonToMmkv } from "../storage/mmkvHotStorage";

const STORAGE_KEY = "nq.offline.actions.v1";
const MAX_ATTEMPTS = 5;

export type OfflineAction = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  enqueuedAt: number;
  attempts: number;
};

export type OfflineActionResult = "done" | "retry" | "drop";

type Executor = (action: OfflineAction) => Promise<OfflineActionResult>;

const executors = new Map<string, Executor>();
let queue: OfflineAction[] = [];
let hydrated = false;
let flushing = false;

export function registerOfflineActionExecutor(
  kind: string,
  executor: Executor
): void {
  executors.set(kind, executor);
}

async function hydrate(): Promise<void> {
  if (hydrated) return;
  queue = await readJsonFromMmkv<OfflineAction[]>(STORAGE_KEY, []);
  hydrated = true;
}

async function persist(): Promise<void> {
  await writeJsonToMmkv(STORAGE_KEY, queue);
}

export async function enqueueOfflineAction(
  kind: string,
  payload: Record<string, unknown>,
  id?: string
): Promise<void> {
  await hydrate();
  const actionId =
    id ?? `${kind}:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  queue = queue
    .filter((row) => row.id !== actionId)
    .concat({
      id: actionId,
      kind,
      payload,
      enqueuedAt: Date.now(),
      attempts: 0,
    });
  await persist();
}

export async function flushOfflineActions(): Promise<{
  done: number;
  failed: number;
}> {
  await hydrate();
  if (flushing || !isNetworkOnline()) return { done: 0, failed: 0 };
  flushing = true;
  let done = 0;
  let failed = 0;
  try {
    const pending = [...queue];
    for (const action of pending) {
      if (!isNetworkOnline()) break;
      const executor = executors.get(action.kind);
      if (!executor) {
        queue = queue.filter((row) => row.id !== action.id);
        continue;
      }
      try {
        const result = await executor(action);
        if (result === "done") {
          queue = queue.filter((row) => row.id !== action.id);
          done += 1;
        } else if (result === "drop") {
          queue = queue.filter((row) => row.id !== action.id);
          failed += 1;
        } else {
          const nextAttempts = action.attempts + 1;
          if (nextAttempts >= MAX_ATTEMPTS) {
            queue = queue.filter((row) => row.id !== action.id);
            failed += 1;
          } else {
            queue = queue.map((row) =>
              row.id === action.id ? { ...row, attempts: nextAttempts } : row
            );
          }
        }
      } catch (err: unknown) {
        const isNetwork =
          typeof err === "object" &&
          err !== null &&
          !("response" in err) &&
          ("code" in err
            ? (err as { code?: string }).code === "ERR_NETWORK" ||
              (err as { code?: string }).code === "ECONNABORTED"
            : true);
        if (isNetwork) break;
        const nextAttempts = action.attempts + 1;
        if (nextAttempts >= MAX_ATTEMPTS) {
          queue = queue.filter((row) => row.id !== action.id);
          failed += 1;
        } else {
          queue = queue.map((row) =>
            row.id === action.id ? { ...row, attempts: nextAttempts } : row
          );
        }
      }
    }
    await persist();
  } finally {
    flushing = false;
  }
  return { done, failed };
}

/** Mount once at app root — flushes when connectivity returns. */
export function useOfflineActionQueueFlusher(): void {
  const online = useNetworkOnline();
  useEffect(() => {
    void hydrate();
  }, []);
  useEffect(() => {
    if (online) void flushOfflineActions();
  }, [online]);
}
