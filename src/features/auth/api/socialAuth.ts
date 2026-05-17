import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../constants/routes";
import { extractLoginTokens } from "../../../lib/http/parseLoginResponse";
import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from "../../../config/env";

WebBrowser.maybeCompleteAuthSession();

export type SocialAuthResult =
  | { kind: "tokens"; access_token: string; account_type: string }
  | { kind: "register_pending"; email: string; provider: "google" | "apple" };

function parseVerifyResponse(data: unknown): SocialAuthResult | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;

  const tokens = extractLoginTokens(data);
  if (tokens) return { kind: "tokens", ...tokens };

  const inner = root.data;
  if (inner && typeof inner === "object") {
    const block = inner as Record<string, unknown>;
    if (block.isRegistered === false && typeof block.email === "string") {
      return {
        kind: "register_pending",
        email: block.email,
        provider: "google",
      };
    }
  }

  return null;
}

export async function postGoogleVerify(body: {
  email: string;
  id_token: string;
}): Promise<SocialAuthResult> {
  const { data } = await apiClient.post(API_ROUTES.auth.verifyGoogleLogin, {
    email: body.email.trim().toLowerCase(),
    id_token: body.id_token,
  });
  const parsed = parseVerifyResponse(data);
  if (!parsed) {
    throw new Error("Unexpected Google sign-in response.");
  }
  if (parsed.kind === "register_pending") {
    return { ...parsed, provider: "google" };
  }
  return parsed;
}

export async function postAppleVerify(body: {
  email?: string;
  identity_token: string;
}): Promise<SocialAuthResult> {
  const { data } = await apiClient.post(API_ROUTES.auth.verifyAppleLogin, body);
  const parsed = parseVerifyResponse(data);
  if (!parsed) {
    throw new Error("Unexpected Apple sign-in response.");
  }
  if (parsed.kind === "register_pending") {
    return { ...parsed, provider: "apple" };
  }
  return parsed;
}

export function useGoogleAuthRequest() {
  const webClientId = GOOGLE_WEB_CLIENT_ID || undefined;
  return Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID || webClientId,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || webClientId,
    webClientId,
  });
}

export async function signInWithAppleNative(): Promise<{
  identityToken: string;
  email: string | null;
}> {
  if (Platform.OS !== "ios") {
    throw new Error("Apple Sign In is only available on iOS.");
  }
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new Error("Apple Sign In is not available on this device.");
  }
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) {
    throw new Error("Apple Sign In did not return an identity token.");
  }
  return {
    identityToken: credential.identityToken,
    email: credential.email,
  };
}

/** True if any Google OAuth client ID is set (not necessarily valid on this platform). */
export function isGoogleConfigured(): boolean {
  return !!(GOOGLE_IOS_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID);
}

/** True when the current platform has the client ID required by expo-auth-session. */
export function isGoogleConfiguredForPlatform(): boolean {
  if (Platform.OS === "ios") {
    return !!(GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID);
  }
  if (Platform.OS === "android") {
    return !!(GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID);
  }
  return !!GOOGLE_WEB_CLIENT_ID;
}
