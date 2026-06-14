/** Matrix: C6 — offline screenshot queue */
jest.mock("../../../lib/storage/mmkvHotStorage", () => {
  const store = new Map<string, string>();
  return {
    mmkvHotStorage: {
      getString: (key: string) => store.get(key),
      set: (key: string, value: string) => {
        store.set(key, value);
      },
      delete: (key: string) => {
        store.delete(key);
      },
      __clear: () => store.clear(),
    },
    readJsonFromMmkv: async <T,>(key: string, fallback: T): Promise<T> => {
      const raw = store.get(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    },
    writeJsonToMmkv: async (key: string, value: unknown) => {
      store.set(key, JSON.stringify(value));
    },
  };
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import { mmkvHotStorage } from "../../../lib/storage/mmkvHotStorage";
import {
  enqueueScreenshotUpload,
  flushScreenshotUploadQueue,
  replaceQueuedUploadUri,
} from "../screenshotUploadQueue";

jest.mock("../meetingReportApi", () => ({
  requestScreenshotUpload: jest.fn().mockResolvedValue({
    url: "https://s3.example/upload",
    filename: "file-new.jpg",
  }),
}));

jest.mock("../../../lib/presignedPut", () => ({
  putFileToPresignedUrl: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-file-system/legacy", () => ({
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

import { requestScreenshotUpload } from "../meetingReportApi";

describe("screenshotUploadQueue", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (mmkvHotStorage as { __clear?: () => void }).__clear?.();
    jest.clearAllMocks();
  });

  it("enqueues and flushes upload", async () => {
    await enqueueScreenshotUpload({
      localUri: "file:///tmp/shot.jpg",
      sessionId: "sess1",
      trainerId: "t1",
      traineeId: "tr1",
    });
    const onUploaded = jest.fn();
    const n = await flushScreenshotUploadQueue({
      sessionId: "sess1",
      onUploaded,
    });
    expect(n).toBe(1);
    expect(requestScreenshotUpload).toHaveBeenCalled();
    expect(onUploaded).toHaveBeenCalledWith("file-new.jpg");
  });

  it("replaces queued uri after crop", async () => {
    await enqueueScreenshotUpload({
      localUri: "file:///tmp/old.jpg",
      sessionId: "sess1",
      trainerId: "t1",
      traineeId: "tr1",
    });
    await replaceQueuedUploadUri("file:///tmp/old.jpg", "file:///tmp/cropped.jpg");
    const n = await flushScreenshotUploadQueue({ sessionId: "sess1" });
    expect(n).toBe(1);
  });
});
