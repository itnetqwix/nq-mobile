import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

/**
 * Best-effort text send for flows outside ChatRoom (game plan, nudges, etc.).
 */
export async function sendChatTextMessage(payload: {
  receiverId: string;
  content: string;
  conversationId?: string;
}): Promise<{ conversationId: string; messageId?: string }> {
  const clientId = `sys_${Date.now()}`;
  const res = await apiClient.post(API_ROUTES.chat.send, {
    receiverId: payload.receiverId,
    content: payload.content,
    type: "text",
    conversationId: payload.conversationId,
    clientMessageId: clientId,
  });
  const data = (res as { data?: { data?: { message?: { _id?: string; conversationId?: string } } } })
    ?.data?.data;
  const message = data?.message;
  const convId = String(
    message?.conversationId ?? payload.conversationId ?? ""
  );
  if (!convId) throw new Error("Could not open chat.");
  return {
    conversationId: convId,
    messageId: message?._id ? String(message._id) : undefined,
  };
}
