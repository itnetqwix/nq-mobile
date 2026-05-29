import { editChatMessage, deleteChatMessage } from "../api/chatActionsApi";
import { isNetworkSendError } from "./mediaSendUtils";
import {
  enqueueChatMutation,
  flushOfflineChatMutations,
} from "./offlineChatMutations";
import { isNetworkOnline } from "../../../lib/networkStatusStore";

function mutationId(messageId: string, type: "edit" | "delete") {
  return `${type}:${messageId}`;
}

export async function performEditChatMessage(params: {
  messageId: string;
  content: string;
  conversationId: string;
}): Promise<{ queued: boolean }> {
  const trimmed = params.content.trim();
  if (!trimmed) return { queued: false };

  const queue = async () => {
    await enqueueChatMutation({
      id: mutationId(params.messageId, "edit"),
      type: "edit",
      messageId: params.messageId,
      content: trimmed,
      conversationId: params.conversationId,
      enqueuedAt: Date.now(),
      attempts: 0,
    });
  };

  if (!isNetworkOnline()) {
    await queue();
    return { queued: true };
  }

  try {
    await editChatMessage(params.messageId, trimmed);
    return { queued: false };
  } catch (e) {
    if (isNetworkSendError(e)) {
      await queue();
      return { queued: true };
    }
    throw e;
  }
}

export async function performDeleteChatMessage(params: {
  messageId: string;
  conversationId: string;
}): Promise<{ queued: boolean }> {
  const queue = async () => {
    await enqueueChatMutation({
      id: mutationId(params.messageId, "delete"),
      type: "delete",
      messageId: params.messageId,
      conversationId: params.conversationId,
      enqueuedAt: Date.now(),
      attempts: 0,
    });
  };

  if (!isNetworkOnline()) {
    await queue();
    return { queued: true };
  }

  try {
    await deleteChatMessage(params.messageId);
    return { queued: false };
  } catch (e) {
    if (isNetworkSendError(e)) {
      await queue();
      return { queued: true };
    }
    throw e;
  }
}

export { flushOfflineChatMutations };
