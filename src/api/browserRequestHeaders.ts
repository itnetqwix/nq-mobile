import { Platform } from "react-native";
import { WEB_APP_ORIGIN } from "../config/env";

/** Match browser traffic so CDN/WAF rules allow mobile API + Socket.IO polling. */
export function browserLikeUserAgent(): string {
  if (Platform.OS === "ios") {
    return "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  }
  return "Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
}

export function getBrowserLikeRequestHeaders(): Record<string, string> {
  return {
    Accept: "application/json, text/plain, */*",
    Origin: WEB_APP_ORIGIN,
    Referer: `${WEB_APP_ORIGIN}/`,
    "User-Agent": browserLikeUserAgent(),
  };
}
