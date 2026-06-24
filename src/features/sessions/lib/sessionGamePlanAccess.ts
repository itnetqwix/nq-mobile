import { getS3ImageUrl } from "../../../lib/imageUtils";
import { isLikelyPdf } from "../../../lib/clipMediaUrl";
import { fetchSessionReport } from "../../calling/meetingReportApi";
import type { LockerViewerMode } from "../../dashboard/components/locker/LockerViewerModal";

export type GamePlanViewerPayload = {
  uri: string;
  title: string;
  mode: LockerViewerMode;
};

export async function resolveSessionGamePlanViewer(params: {
  sessionId: string;
  trainerId: string;
  traineeId: string;
  fallbackTitle?: string;
}): Promise<GamePlanViewerPayload | null> {
  const res = await fetchSessionReport({
    sessions: params.sessionId,
    trainer: params.trainerId,
    trainee: params.traineeId,
  });
  const data = (res as { data?: Record<string, unknown> })?.data ?? res;
  const reportData = (data?.reportData as { imageUrl?: string; title?: string }[] | undefined)?.[0];
  const title =
    reportData?.title ??
    (typeof data?.title === "string" ? data.title : null) ??
    params.fallbackTitle ??
    "Game Plan";
  const session = data?.session as
    | { report?: string; sessionRecordingUrl?: string; game_plan_pdf_version?: number }
    | undefined;
  const pdfName = session?.report ?? (typeof data?.report === "string" ? data.report : null);
  const pdfVersion = session?.game_plan_pdf_version;
  const recording =
    session?.sessionRecordingUrl ??
    (typeof data?.sessionRecordingUrl === "string" ? data.sessionRecordingUrl : null);

  const fromImg = reportData?.imageUrl ? getS3ImageUrl(reportData.imageUrl) : "";
  const fromPdf = pdfName
    ? `${getS3ImageUrl(pdfName)}${pdfVersion ? `?v=${pdfVersion}` : ""}`
    : "";
  const fromRec = typeof recording === "string" && recording.length > 0 ? getS3ImageUrl(recording) : "";
  const uri = fromPdf || fromImg || fromRec;
  if (!uri) return null;

  let mode: LockerViewerMode;
  if (fromImg && !isLikelyPdf(fromImg)) mode = "image";
  else if (fromPdf || isLikelyPdf(uri)) mode = "pdf";
  else mode = "video";
  return { uri, title, mode };
}

export function sessionPartyIds(session: Record<string, unknown> | null | undefined): {
  trainerId: string;
  traineeId: string;
} {
  const trainerId = String(
    session?.trainer ??
      (session?.trainer_info as { _id?: string } | undefined)?._id ??
      (session?.trainerId as string | undefined) ??
      ""
  );
  const traineeId = String(
    session?.trainee ??
      (session?.trainee_info as { _id?: string } | undefined)?._id ??
      (session?.traineeId as string | undefined) ??
      ""
  );
  return { trainerId, traineeId };
}
