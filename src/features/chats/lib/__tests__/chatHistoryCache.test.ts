jest.mock("../../../../lib/storage/mmkvHotStorage", () => {
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

import {
  readCachedChatMessages,
  writeCachedChatMessages,
} from "../chatHistoryCache";

describe("chatHistoryCache", () => {
  beforeEach(async () => {
    const mod = await import("../../../../lib/storage/mmkvHotStorage");
    (mod as { __clear?: () => void }).__clear?.();
  });

  it("returns null when nothing cached", async () => {
    expect(await readCachedChatMessages("conv-1")).toBeNull();
  });

  it("writes and reads messages", async () => {
    const rows = [{ _id: "m1", content: "hi" }];
    await writeCachedChatMessages("conv-1", rows);
    expect(await readCachedChatMessages("conv-1")).toEqual(rows);
  });

  it("trims to max messages per conversation", async () => {
    const rows = Array.from({ length: 260 }, (_, i) => ({
      _id: `m${i}`,
      content: `msg-${i}`,
    }));
    await writeCachedChatMessages("conv-big", rows);
    const cached = await readCachedChatMessages("conv-big");
    expect(cached).toHaveLength(250);
    expect(cached?.[0]._id).toBe("m10");
  });
});
