jest.mock("../storage/mmkvHotStorage", () => {
  const store = new Map<string, string>();
  return {
    readJsonFromMmkv: async <T,>(key: string, fallback: T): Promise<T> => {
      const raw = store.get(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    },
    writeJsonToMmkv: async (key: string, value: unknown) => {
      if (value == null) store.delete(key);
      else store.set(key, JSON.stringify(value));
    },
    __clear: () => store.clear(),
  };
});

jest.mock("../networkStatusStore", () => ({
  isNetworkOnline: jest.fn(() => true),
  useNetworkOnline: jest.fn(() => true),
}));

import {
  enqueueOfflineAction,
  flushOfflineActions,
  registerOfflineActionExecutor,
  type OfflineActionResult,
} from "../offline/offlineActionQueue";
import { readJsonFromMmkv } from "../storage/mmkvHotStorage";

describe("offlineActionQueue", () => {
  beforeEach(async () => {
    const mod = await import("../storage/mmkvHotStorage");
    (mod as { __clear?: () => void }).__clear?.();
    jest.clearAllMocks();
  });

  it("enqueues and executes registered kind", async () => {
    const run = jest.fn(async (): Promise<OfflineActionResult> => "done");
    registerOfflineActionExecutor("test.kind", run);
    await enqueueOfflineAction("test.kind", { sessionId: "s1" });
    const result = await flushOfflineActions();
    expect(result.done).toBe(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("retries on retry result until max attempts", async () => {
    const run = jest.fn(async (): Promise<OfflineActionResult> => "retry");
    registerOfflineActionExecutor("retry.kind", run);
    await enqueueOfflineAction("retry.kind", { n: 1 }, "retry-1");
    for (let i = 0; i < 5; i += 1) {
      await flushOfflineActions();
    }
    const result = await flushOfflineActions();
    expect(result.failed).toBe(0);
    expect(run.mock.calls.length).toBeGreaterThanOrEqual(5);
    const rows = await readJsonFromMmkv<unknown[]>("nq.offline.actions.v1", []);
    expect(rows).toHaveLength(0);
  });

  it("dedupes by explicit id", async () => {
    registerOfflineActionExecutor("dedupe.kind", async () => "done");
    await enqueueOfflineAction("dedupe.kind", { a: 1 }, "same-id");
    await enqueueOfflineAction("dedupe.kind", { a: 2 }, "same-id");
    const rows = await readJsonFromMmkv<{ id: string; payload: { a: number } }[]>(
      "nq.offline.actions.v1",
      []
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].payload.a).toBe(2);
  });
});
