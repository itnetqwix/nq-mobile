import AsyncStorage from "@react-native-async-storage/async-storage";

const prefix = "@netqwix:rating.shown:";

/** Ratings after a lesson should show once per booking — never block rejoin. */
export async function hasShownSessionRating(lessonId: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(`${prefix}${lessonId}`);
    return v === "1";
  } catch {
    return false;
  }
}

export async function markSessionRatingShown(lessonId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`${prefix}${lessonId}`, "1");
  } catch {
    /* noop */
  }
}
