import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

export async function editChatMessage(messageId: string, content: string) {
  const res = await apiClient.post(API_ROUTES.chat.editMessage, { messageId, content });
  return res.data;
}

export async function deleteChatMessage(messageId: string) {
  const res = await apiClient.post(API_ROUTES.chat.deleteMessage, { messageId });
  return res.data;
}

export async function archiveChatConversation(conversationId: string) {
  const res = await apiClient.post(API_ROUTES.chat.archiveConversation, { conversationId });
  return res.data;
}

export async function unarchiveChatConversation(conversationId: string) {
  const res = await apiClient.post(API_ROUTES.chat.unarchiveConversation, { conversationId });
  return res.data;
}

export async function fetchArchivedConversations(): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.chat.archivedConversations);
  const body = (res as any)?.data ?? res;
  return body?.data ?? body?.result ?? [];
}

export async function deleteChatConversation(conversationId: string) {
  const res = await apiClient.post(API_ROUTES.chat.deleteConversation, { conversationId });
  return res.data;
}

export async function clearChatConversation(conversationId: string) {
  const res = await apiClient.post(API_ROUTES.chat.clearConversation, { conversationId });
  return res.data;
}

export async function fetchGroupInvites() {
  const res = await apiClient.get(API_ROUTES.chat.groupInvites);
  return res.data?.data ?? res.data?.result ?? [];
}

export async function respondGroupInvite(conversationId: string, accept: boolean) {
  const res = await apiClient.post(API_ROUTES.chat.respondGroupInvite, {
    conversationId,
    accept,
  });
  return res.data;
}

export async function createGroupWithInvites(payload: {
  participantIds: string[];
  groupName: string;
  groupDescription?: string;
  groupAvatar?: string | null;
}) {
  const res = await apiClient.post(API_ROUTES.chat.createGroupInvite, payload);
  return res.data;
}

export async function fetchGroupDetail(conversationId: string) {
  const res = await apiClient.get(API_ROUTES.chat.groupDetail(conversationId));
  return res.data?.data ?? res.data?.result ?? res.data;
}

export async function fetchGroupMembers(
  conversationId: string,
  search = "",
  page = 1
) {
  const res = await apiClient.get(API_ROUTES.chat.groupMembers(conversationId), {
    params: { search, page, limit: 50 },
  });
  return res.data?.data ?? res.data?.result ?? res.data;
}

export async function inviteToGroup(conversationId: string, participantIds: string[]) {
  const res = await apiClient.post(API_ROUTES.chat.groupInvite(conversationId), {
    participantIds,
  });
  return res.data;
}

export async function removeGroupMember(conversationId: string, memberId: string) {
  const res = await apiClient.post(API_ROUTES.chat.groupRemoveMember(conversationId), {
    memberId,
  });
  return res.data;
}

export async function exitGroup(conversationId: string) {
  const res = await apiClient.post(API_ROUTES.chat.groupExit(conversationId));
  return res.data;
}

export async function deleteGroup(conversationId: string) {
  const res = await apiClient.post(API_ROUTES.chat.groupDelete(conversationId));
  return res.data;
}

export async function updateGroup(
  conversationId: string,
  patch: { groupName?: string; groupDescription?: string; groupAvatar?: string | null }
) {
  const res = await apiClient.post(API_ROUTES.chat.groupUpdate(conversationId), patch);
  return res.data?.data ?? res.data?.result ?? res.data;
}

// ─── Reactions / forward / pins / search / transcribe / TTL / receipts / schedule ───

export type Reaction = { user_id: string; emoji: string };

export async function reactToMessage(messageId: string, emoji: string) {
  const res = await apiClient.post(API_ROUTES.chat.react, { messageId, emoji });
  return res.data?.data ?? res.data?.result ?? res.data;
}

export async function forwardChatMessage(
  messageId: string,
  targets: Array<{ conversationId?: string; otherUserId?: string }>
) {
  const res = await apiClient.post(API_ROUTES.chat.forward, { messageId, targets });
  return res.data?.data ?? res.data?.result ?? res.data;
}

export async function pinChatMessage(messageId: string) {
  const res = await apiClient.post(API_ROUTES.chat.pin, { messageId });
  return res.data?.data ?? res.data?.result ?? res.data;
}

export async function unpinChatMessage(conversationId: string) {
  const res = await apiClient.post(API_ROUTES.chat.unpin, { conversationId });
  return res.data?.data ?? res.data?.result ?? res.data;
}

export async function fetchPinnedMessage(conversationId: string) {
  const res = await apiClient.get(API_ROUTES.chat.pinned(conversationId));
  const body = res.data?.data ?? res.data?.result ?? res.data;
  return body?.pinned ?? null;
}

export async function searchAllMessages(q: string) {
  const res = await apiClient.get(API_ROUTES.chat.searchAll, { params: { q, limit: 25 } });
  const body = res.data?.data ?? res.data?.result ?? res.data;
  return (body?.results as any[]) ?? [];
}

export async function transcribeVoiceMessage(messageId: string) {
  const res = await apiClient.post(API_ROUTES.chat.transcribe, { messageId });
  return res.data?.data ?? res.data?.result ?? res.data;
}

export async function setConversationDisappearingTtl(
  conversationId: string,
  minutes: number
) {
  const res = await apiClient.post(API_ROUTES.chat.disappearing, {
    conversationId,
    minutes,
  });
  return res.data?.data ?? res.data?.result ?? res.data;
}

export async function setReadReceiptsEnabled(enabled: boolean) {
  const res = await apiClient.post(API_ROUTES.chat.readReceipts, { enabled });
  return res.data?.data ?? res.data?.result ?? res.data;
}

export type ScheduledMessage = {
  _id: string;
  conversationId?: any;
  receiverId?: any;
  content: string;
  type: string;
  mediaUrl: string | null;
  scheduledFor: string;
  status: "pending" | "sent" | "failed" | "cancelled";
};

export async function scheduleChatMessage(payload: {
  conversationId?: string;
  receiverId?: string;
  content: string;
  type?: string;
  mediaUrl?: string | null;
  scheduledFor: string | Date;
  timezone?: string;
}) {
  const res = await apiClient.post(API_ROUTES.chat.scheduled, {
    ...payload,
    scheduledFor:
      payload.scheduledFor instanceof Date
        ? payload.scheduledFor.toISOString()
        : payload.scheduledFor,
  });
  return res.data?.data ?? res.data?.result ?? res.data;
}

export async function listScheduledMessages(): Promise<ScheduledMessage[]> {
  const res = await apiClient.get(API_ROUTES.chat.scheduled);
  const body = res.data?.data ?? res.data?.result ?? res.data;
  return (body?.items as ScheduledMessage[]) ?? [];
}

export async function cancelScheduledMessage(id: string) {
  const res = await apiClient.delete(API_ROUTES.chat.cancelScheduled(id));
  return res.data?.data ?? res.data?.result ?? res.data;
}
