import AsyncStorage from "@react-native-async-storage/async-storage";

const traineeNoteKey = (traineeId: string) =>
  `@netqwix:chat.pinnedNote.collapsed:${traineeId}`;

const messagePinKey = (conversationId: string) =>
  `@netqwix:chat.pinnedMsg.collapsed:${conversationId}`;

export async function getTraineeNoteCollapsed(traineeId: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(traineeNoteKey(traineeId));
    return v === "1";
  } catch {
    return false;
  }
}

export async function setTraineeNoteCollapsed(
  traineeId: string,
  collapsed: boolean
): Promise<void> {
  try {
    await AsyncStorage.setItem(traineeNoteKey(traineeId), collapsed ? "1" : "0");
  } catch {
    /** ignore */
  }
}

export async function getPinnedMessageCollapsed(
  conversationId: string
): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(messagePinKey(conversationId));
    return v === "1";
  } catch {
    return false;
  }
}

export async function setPinnedMessageCollapsed(
  conversationId: string,
  collapsed: boolean
): Promise<void> {
  try {
    await AsyncStorage.setItem(messagePinKey(conversationId), collapsed ? "1" : "0");
  } catch {
    /** ignore */
  }
}
