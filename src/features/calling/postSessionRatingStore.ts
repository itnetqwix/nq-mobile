import AsyncStorage from "@react-native-async-storage/async-storage";

const shownPrefix = "@netqwix:rating.shown:";
const pendingKey = "@netqwix:rating.pending";
const bannerDismissPrefix = "@netqwix:rating.banner.dismissed:";

/** In-call modal was shown or user skipped — do not auto-open again on timer end. */
export async function hasShownSessionRating(lessonId: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(`${shownPrefix}${lessonId}`);
    return v === "1";
  } catch {
    return false;
  }
}

export async function markSessionRatingShown(lessonId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`${shownPrefix}${lessonId}`, "1");
    await clearPendingSessionRating();
  } catch {
    /* noop */
  }
}

/** User left the call without submitting — home can remind them. */
export async function stashPendingSessionRating(lessonId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(pendingKey, lessonId);
  } catch {
    /* noop */
  }
}

export async function peekPendingSessionRating(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(pendingKey);
  } catch {
    return null;
  }
}

export async function consumePendingSessionRating(): Promise<string | null> {
  try {
    const id = await AsyncStorage.getItem(pendingKey);
    if (id) await AsyncStorage.removeItem(pendingKey);
    return id;
  } catch {
    return null;
  }
}

export async function clearPendingSessionRating(): Promise<void> {
  try {
    await AsyncStorage.removeItem(pendingKey);
  } catch {
    /* noop */
  }
}

export async function isRatingBannerDismissed(lessonId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(`${bannerDismissPrefix}${lessonId}`)) === "1";
  } catch {
    return false;
  }
}

export async function dismissRatingBanner(lessonId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`${bannerDismissPrefix}${lessonId}`, "1");
    await clearPendingSessionRating();
  } catch {
    /* noop */
  }
}
