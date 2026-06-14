import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import {
  abortChatMediaUpload,
  getPresignedUploadUrl,
  isNetworkSendError,
  uploadToS3,
} from "./mediaSendUtils";
import {
  enqueueChatMessage,
  type QueuedChatMessage,
} from "./offlineChatQueue";

export type ChatSendPayload = {
  clientMessageId: string;
  conversationId: string;
  receiverId?: string;
  content: string;
  type: "text" | "image" | "video" | "voice";
  mediaUrl?: string | null;
  replyToMessageId?: string | null;
  localFileUri?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  mediaS3Key?: string | null;
};

export type ChatSendResult =
  | { ok: true; message: Record<string, unknown>; queued: false }
  | { ok: true; queued: true }
  | { ok: false; status?: number; error?: string; policy?: Record<string, unknown> };

function unwrapSendResponse(res: unknown): Record<string, unknown> | null {
  const data = (res as any)?.data?.data ?? (res as any)?.data;
  const message = data?.message ?? data;
  return message && typeof message === "object" ? message : null;
}

export async function postChatMessage(
  payload: ChatSendPayload
): Promise<ChatSendResult> {
  try {
    const res = await apiClient.post(API_ROUTES.chat.send, {
      receiverId: payload.receiverId ?? undefined,
      conversationId: payload.conversationId,
      content: payload.content,
      type: payload.type,
      mediaUrl: payload.mediaUrl ?? undefined,
      replyToMessageId: payload.replyToMessageId ?? undefined,
      clientMessageId: payload.clientMessageId,
    });
    const message = unwrapSendResponse(res);
    if (!message) {
      return { ok: false, error: "Invalid server response." };
    }
    return { ok: true, message, queued: false };
  } catch (e: any) {
    if (isNetworkSendError(e)) {
      const item: QueuedChatMessage = {
        clientId: payload.clientMessageId,
        conversationId: payload.conversationId,
        receiverId: payload.receiverId ?? null,
        content: payload.content,
        type: payload.type,
        mediaUrl: payload.mediaUrl ?? null,
        localFileUri: payload.localFileUri ?? null,
        fileName: payload.fileName ?? null,
        mimeType: payload.mimeType ?? null,
        mediaS3Key: payload.mediaS3Key ?? null,
        replyToMessageId: payload.replyToMessageId ?? null,
        enqueuedAt: Date.now(),
        attempts: 0,
      };
      await enqueueChatMessage(item);
      return { ok: true, queued: true };
    }
    const status = e?.response?.status;
    const body = e?.response?.data?.data ?? e?.response?.data;
    return {
      ok: false,
      status,
      error: body?.error ?? e?.message ?? "Could not send message.",
      policy: body?.policy,
    };
  }
}

export async function uploadAndSendChatMedia(
  payload: Omit<ChatSendPayload, "mediaUrl"> & {
    fileUri: string;
    fileName: string;
    mimeType: string;
  }
): Promise<ChatSendResult & { mediaS3Key?: string }> {
  let mediaS3Key: string | undefined;
  try {
    const { uploadUrl, mediaUrl, key } = await getPresignedUploadUrl(
      payload.fileName,
      payload.mimeType
    );
    mediaS3Key = key;
    await uploadToS3(uploadUrl, payload.fileUri, payload.mimeType);
    const result = await postChatMessage({
      ...payload,
      mediaUrl,
      mediaS3Key: key,
      localFileUri: payload.fileUri,
      fileName: payload.fileName,
      mimeType: payload.mimeType,
    });
    if (!result.ok && mediaS3Key) {
      await abortChatMediaUpload(mediaS3Key);
    }
    return { ...result, mediaS3Key };
  } catch (e: any) {
    if (mediaS3Key) {
      await abortChatMediaUpload(mediaS3Key);
    }
    if (isNetworkSendError(e)) {
      const queued = await postChatMessage({
        ...payload,
        mediaUrl: null,
        mediaS3Key,
        localFileUri: payload.fileUri,
        fileName: payload.fileName,
        mimeType: payload.mimeType,
      });
      return { ...queued, mediaS3Key };
    }
    return {
      ok: false,
      error: e?.response?.data?.message ?? e?.message ?? "Could not send media.",
    };
  }
}
