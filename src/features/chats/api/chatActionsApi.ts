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
