import { Alert } from "react-native";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import type { ChatTabOpenPayload } from "../../../navigation/types";
import { openChatInTab } from "./openChatTab";

/**
 * Creates (or reuses) a 1:1 conversation and navigates to the Chats tab.
 */
export async function openChatWithUser(
  navigation: unknown,
  user: { _id: string; fullname?: string; profile_picture?: string },
  t: (key: string, opts?: Record<string, unknown>) => string
): Promise<void> {
  try {
    const res = await apiClient.post(API_ROUTES.chat.conversation, {
      otherUserId: user._id,
      participantId: user._id,
    });
    const body = (res as { data?: unknown })?.data ?? res;
    const conversation =
      (body as { data?: Record<string, unknown> })?.data ??
      (body as { result?: Record<string, unknown> })?.result ??
      body;
    const convId = String(
      (conversation as { _id?: string; conversationId?: string })?._id ??
        (conversation as { conversationId?: string })?.conversationId ??
        ""
    );
    if (!convId) {
      Alert.alert(t("common.error"), t("friends.couldNotOpenChat"));
      return;
    }
    const payload: ChatTabOpenPayload = {
      conversationId: convId,
      partner: {
        _id: user._id,
        fullname: user.fullname ?? t("trainees.studentDefault"),
        profile_picture: user.profile_picture,
      },
    };
    openChatInTab(navigation, payload);
  } catch (e: unknown) {
    const err = e as {
      response?: { data?: { message?: string; error?: string } };
      message?: string;
    };
    const msg =
      err?.response?.data?.message ??
      err?.response?.data?.error ??
      err?.message ??
      t("friends.couldNotOpenChat");
    Alert.alert(t("common.error"), String(msg));
  }
}
