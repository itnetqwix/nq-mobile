import * as FileSystem from "expo-file-system/legacy";

const CACHE_DIR = `${FileSystem.documentDirectory ?? ""}nq-cache/`;

async function ensureCacheDir(): Promise<string> {
  const dir = CACHE_DIR;
  if (!dir) return "";
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

function filePath(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${CACHE_DIR}${safe}.json`;
}

/** Persist JSON larger than SecureStore's ~2KB limit (loader tips, etc.). */
export async function writeFileCache(key: string, value: unknown): Promise<void> {
  const dir = await ensureCacheDir();
  if (!dir) return;
  await FileSystem.writeAsStringAsync(filePath(key), JSON.stringify(value), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function readFileCache<T>(key: string): Promise<T | null> {
  const dir = await ensureCacheDir();
  if (!dir) return null;
  const path = filePath(key);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  try {
    const raw = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function deleteFileCache(key: string): Promise<void> {
  const path = filePath(key);
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) {
    await FileSystem.deleteAsync(path, { idempotent: true });
  }
}
