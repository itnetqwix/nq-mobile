import type { ReportScreenshotItem } from "./reportDataUtils";
import { SERVER_GAME_PLAN_PDF_ENABLED } from "../../config/env";

export function reportPayloadHasImages(
  items: Array<{ imageUrl?: string }>
): boolean {
  return items.some((row) => typeof row.imageUrl === "string" && row.imageUrl.length > 0);
}

/** When true, mobile skips expo-print + presigned PDF upload; backend BullMQ stitches. */
export function shouldUseServerGamePlanPdfStitch(
  payloadItems: ReportScreenshotItem[] | Array<{ imageUrl?: string }>
): boolean {
  return SERVER_GAME_PLAN_PDF_ENABLED && reportPayloadHasImages(payloadItems);
}
