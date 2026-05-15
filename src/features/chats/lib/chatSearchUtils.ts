export function formatDayLabel(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round(
      (startOfToday.getTime() - startOfDay.getTime()) / (24 * 60 * 60 * 1000)
    );
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "Earlier";
  }
}

export function getSearchableText(m: {
  type: string;
  content?: string | null;
}): string {
  if (m.type === "text") return (m.content ?? "").trim();
  if (m.type === "image") return "Photo";
  if (m.type === "video") return "Video";
  if (m.type === "voice") return "Voice message";
  return (m.content ?? "").trim();
}

export function messageMatchesQuery(
  m: { type: string; content?: string | null },
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return getSearchableText(m).toLowerCase().includes(q);
}

export type TextPart = { text: string; highlight: boolean };

/** Split text into highlighted segments for the search query. */
export function highlightQueryParts(text: string, query: string): TextPart[] {
  const q = query.trim();
  if (!q) return [{ text, highlight: false }];
  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx < 0) return [{ text, highlight: false }];
  const parts: TextPart[] = [];
  if (idx > 0) parts.push({ text: text.slice(0, idx), highlight: false });
  parts.push({ text: text.slice(idx, idx + q.length), highlight: true });
  if (idx + q.length < text.length) {
    parts.push({ text: text.slice(idx + q.length), highlight: false });
  }
  return parts;
}

export function groupMessagesByDay<T extends { createdAt: string }>(
  items: T[],
  getLabel: (iso: string) => string = formatDayLabel
): Array<{ title: string; data: T[] }> {
  const map = new Map<string, T[]>();
  const order: string[] = [];
  for (const item of items) {
    const key = formatDayLabel(item.createdAt);
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(item);
  }
  return order.map((title) => ({ title, data: map.get(title)! }));
}
