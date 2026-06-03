const asyncStore = new Map();
jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn((key, value) => {
    asyncStore.set(key, value);
    return Promise.resolve();
  }),
  getItem: jest.fn((key) => Promise.resolve(asyncStore.get(key) ?? null)),
  removeItem: jest.fn((key) => {
    asyncStore.delete(key);
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    asyncStore.clear();
    return Promise.resolve();
  }),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([...asyncStore.keys()])),
}));

jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "/cache/",
  EncodingType: { Base64: "base64" },
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1000 }),
  readAsStringAsync: jest.fn().mockResolvedValue(""),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  downloadAsync: jest.fn().mockResolvedValue({ status: 200 }),
}));
