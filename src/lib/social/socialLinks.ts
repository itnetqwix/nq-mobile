import { Alert, Linking } from "react-native";

/** Matches web `extraInfo.social_media_links` (`slack` = personal website). */
export type SocialMediaLinks = {
  fb?: string;
  instagram?: string;
  slack?: string;
  twitter?: string;
  google?: string;
  profile_image_url?: string;
};

export type PublicSocialKind = "facebook" | "instagram" | "website";

const URL_REGEX = /^https?:\/\/.+/i;

export function getSocialLinksFromUser(
  user: Record<string, unknown> | null | undefined
): SocialMediaLinks {
  if (!user) return {};
  const extra = user.extraInfo;
  if (!extra || typeof extra !== "object") return {};
  const links = (extra as Record<string, unknown>).social_media_links;
  if (!links || typeof links !== "object") return {};
  return links as SocialMediaLinks;
}

export function hasPublicSocialLinks(links: SocialMediaLinks): boolean {
  return Boolean(
    links.fb?.trim() || links.instagram?.trim() || links.slack?.trim()
  );
}

function stripAt(handle: string): string {
  return handle.replace(/^@+/, "").trim();
}

/** Normalize user input to a safe https URL before save. */
export function normalizeSocialUrl(raw: string, kind: PublicSocialKind): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (URL_REGEX.test(trimmed)) return trimmed;

  const handle = stripAt(trimmed);

  if (kind === "instagram") {
    if (trimmed.includes("instagram.com")) return `https://${trimmed.replace(/^https?:\/\//i, "")}`;
    return `https://instagram.com/${handle}`;
  }

  if (kind === "facebook") {
    if (trimmed.includes("facebook.com") || trimmed.includes("fb.com")) {
      return `https://${trimmed.replace(/^https?:\/\//i, "")}`;
    }
    return `https://facebook.com/${handle}`;
  }

  if (!trimmed.includes("://")) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

export function isValidSocialUrl(url: string): boolean {
  if (!url.trim()) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function buildSocialLinksPayload(input: {
  facebook: string;
  instagram: string;
  website: string;
}): SocialMediaLinks {
  return {
    fb: normalizeSocialUrl(input.facebook, "facebook"),
    instagram: normalizeSocialUrl(input.instagram, "instagram"),
    slack: normalizeSocialUrl(input.website, "website"),
  };
}

export async function openSocialLink(url: string, label: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) return;
  const withProtocol = URL_REGEX.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const can = await Linking.canOpenURL(withProtocol);
    if (!can) {
      Alert.alert("Link unavailable", `Could not open ${label}.`);
      return;
    }
    await Linking.openURL(withProtocol);
  } catch {
    Alert.alert("Link unavailable", `Could not open ${label}.`);
  }
}
