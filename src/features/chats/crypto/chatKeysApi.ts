import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { loadOrCreateLocalChatKeys, publicKeyToBase64 } from "./chatEncryption";

export async function registerMyChatPublicKey(): Promise<void> {
  const keys = await loadOrCreateLocalChatKeys();
  const publicKey = publicKeyToBase64(keys.publicKey);
  await apiClient.put(API_ROUTES.user.chatPublicKeyMe, { publicKey });
}

export async function fetchPartnerChatPublicKey(userId: string): Promise<string | null> {
  const res = await apiClient.get(API_ROUTES.user.chatPublicKey(userId));
  const data = (res as { data?: { data?: { publicKey?: string } } })?.data?.data ?? (res as any)?.data;
  const pk = data?.publicKey;
  return typeof pk === "string" && pk.length > 0 ? pk : null;
}
