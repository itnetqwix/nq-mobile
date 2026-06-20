import * as FileSystem from "expo-file-system/legacy";
import { getS3ImageUrl } from "../../lib/imageUtils";

/** Backend report item shape from `/report/add-image` and `/report/create`. */
export type ReportScreenshotItem = {
  title?: string;
  description?: string;
  imageUrl: string;
};

function imageKeyFromEntry(x: unknown): string {
  if (typeof x === "string" && x.trim()) return x.trim();
  if (!x || typeof x !== "object") return "";
  const o = x as Record<string, unknown>;
  const url =
    (typeof o.imageUrl === "string" && o.imageUrl) ||
    (typeof o.name === "string" && o.name) ||
    (typeof o.key === "string" && o.key) ||
    "";
  return url.trim();
}

/** Normalize mixed legacy reportData into S3 image keys. */
export function normalizeReportImageKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(imageKeyFromEntry).filter(Boolean);
}

/** Parse reportData into structured items (preserves descriptions). */
export function parseReportScreenshotItems(raw: unknown): ReportScreenshotItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ReportScreenshotItem[] = [];
  for (const x of raw) {
    const imageUrl = imageKeyFromEntry(x);
    if (!imageUrl) continue;
    if (typeof x === "object" && x !== null) {
      const o = x as Record<string, unknown>;
      out.push({
        imageUrl,
        title: typeof o.title === "string" ? o.title : "",
        description: typeof o.description === "string" ? o.description : "",
      });
    } else {
      out.push({ imageUrl, title: "", description: "" });
    }
  }
  return out;
}

/** Build reportData payload for `/report/create` from items or keys. */
export function toReportDataPayload(
  items: ReportScreenshotItem[]
): ReportScreenshotItem[] {
  return items
    .filter((i) => i.imageUrl)
    .map((i) => ({
      imageUrl: i.imageUrl,
      title: i.title ?? "",
      description: i.description ?? "",
    }));
}

/** Inline placeholder when an S3 frame fails to load for PDF embedding. */
export const PDF_FRAME_IMAGE_MISSING_PLACEHOLDER = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#eef1f5"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14" fill="#5c6370">Image unavailable</text></svg>'
)}`;

async function remoteImageToDataUrl(url: string, attempt = 0): Promise<string | null> {
  try {
    const dest = `${FileSystem.cacheDirectory}gp-${Date.now()}-${Math.random().toString(36).slice(2)}.img`;
    const dl = await FileSystem.downloadAsync(url, dest);
    if (dl.status < 200 || dl.status >= 300) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        return remoteImageToDataUrl(url, attempt + 1);
      }
      return null;
    }
    const b64 = await FileSystem.readAsStringAsync(dl.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.deleteAsync(dl.uri, { idempotent: true }).catch(() => {});
    return `data:image/jpeg;base64,${b64}`;
  } catch {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      return remoteImageToDataUrl(url, attempt + 1);
    }
    return null;
  }
}

/** Fetch S3 images; returns one entry per key (`null` when load fails after retries). */
export async function resolveBase64DataUrlsForPdf(
  keys: string[]
): Promise<Array<string | null>> {
  return Promise.all(
    keys.map(async (key) => {
      const url = getS3ImageUrl(key);
      if (!url) return null;
      return remoteImageToDataUrl(url);
    })
  );
}

/** Fetch S3 images and return base64 data URLs for PDF HTML embedding. */
export async function fetchImageKeysAsBase64DataUrls(
  keys: string[]
): Promise<string[]> {
  const results = await resolveBase64DataUrlsForPdf(keys);
  return results.filter((x): x is string => !!x);
}

/**
 * Web parity: PDF HTML must use inline base64 only (expo-print won't load remote URLs).
 * @throws if every image fails to convert
 */
export async function requireBase64DataUrlsForPdf(keys: string[]): Promise<string[]> {
  const dataUrls = await resolveBase64DataUrlsForPdf(keys);
  if (keys.length === 0) return [];
  const loaded = dataUrls.filter((x): x is string => !!x);
  if (loaded.length === 0) {
    throw new Error(
      "Could not load screenshots for the PDF. Check your connection and try again."
    );
  }
  if (loaded.length !== keys.length) {
    const missing = keys.length - loaded.length;
    throw new Error(
      `Could not load ${missing} screenshot${missing === 1 ? "" : "s"} for the PDF. Check your connection and try again.`
    );
  }
  return loaded;
}
