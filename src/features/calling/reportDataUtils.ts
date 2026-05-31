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

/** Fetch S3 images and return base64 data URLs for PDF HTML embedding. */
export async function fetchImageKeysAsBase64DataUrls(
  keys: string[]
): Promise<string[]> {
  const results = await Promise.all(
    keys.map(async (key) => {
      const url = getS3ImageUrl(key);
      if (!url) return null;
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        return await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result;
            resolve(typeof result === "string" ? result : null);
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    })
  );
  return results.filter((x): x is string => !!x);
}

/**
 * Web parity: PDF HTML must use inline base64 only (expo-print won't load remote URLs).
 * @throws if any image fails to convert
 */
export async function requireBase64DataUrlsForPdf(keys: string[]): Promise<string[]> {
  const dataUrls = await fetchImageKeysAsBase64DataUrls(keys);
  if (keys.length === 0) return [];
  if (dataUrls.length !== keys.length) {
    const missing = keys.length - dataUrls.length;
    throw new Error(
      `Could not load ${missing} screenshot${missing === 1 ? "" : "s"} for the PDF. Check your connection and try again.`
    );
  }
  return dataUrls;
}
