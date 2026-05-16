export type ChatMessageLike = { _id: string; createdAt?: string };

/** WhatsApp-style day label: Today, Yesterday, weekday+date, or DD/MM/YYYY. */
export function formatChatDayLabel(iso: string | undefined): string {
  if (!iso) return "Earlier";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Earlier";
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round(
      (startOfToday.getTime() - startOfDay.getTime()) / (24 * 60 * 60 * 1000)
    );
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    const withinYear = d.getFullYear() === now.getFullYear();
    if (withinYear) {
      return d.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "short",
      });
    }
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  } catch {
    return "Earlier";
  }
}

export function sortMessagesAsc<T extends ChatMessageLike>(messages: T[]): T[] {
  return [...messages].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ta - tb;
  });
}

export type ChatDaySection<T extends ChatMessageLike> = {
  title: string;
  data: T[];
};

/** Ascending sections for SectionList (oldest day first). */
export function groupMessagesByDayAsc<T extends ChatMessageLike>(
  messages: T[]
): ChatDaySection<T>[] {
  const sorted = sortMessagesAsc(messages);
  const map = new Map<string, T[]>();
  for (const m of sorted) {
    const title = formatChatDayLabel(m.createdAt);
    const bucket = map.get(title);
    if (bucket) bucket.push(m);
    else map.set(title, [m]);
  }
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

export function findMessageSectionLocation<T extends ChatMessageLike>(
  sections: ChatDaySection<T>[],
  messageId: string
): { sectionIndex: number; itemIndex: number } | null {
  for (let si = 0; si < sections.length; si++) {
    const idx = sections[si]!.data.findIndex((m) => m._id === messageId);
    if (idx >= 0) return { sectionIndex: si, itemIndex: idx };
  }
  return null;
}
