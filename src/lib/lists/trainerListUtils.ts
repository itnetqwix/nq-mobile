import { getTrainerId } from "../../features/bookexpert/lib/trainerUtils";

export function rowId(row: { _id?: unknown; id?: unknown } | null | undefined): string {
  if (!row) return "";
  if (row._id != null && String(row._id).length > 0) return String(row._id);
  if (row.id != null && String(row.id).length > 0) return String(row.id);
  return "";
}

/** Drop duplicate Mongo rows so list keys stay stable (API/cache may repeat ids). */
export function dedupeTrainersById<T extends Record<string, unknown>>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const id = getTrainerId(row);
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    out.push(row);
  }
  return out;
}

export function dedupeRowsById<T extends { _id?: unknown; id?: unknown }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const id = rowId(row);
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    out.push(row);
  }
  return out;
}

/** Stable React keys even when `_id` repeats in the same list. */
export function listItemKey(
  row: { _id?: unknown; id?: unknown } | null | undefined,
  index: number,
  prefix = ""
): string {
  const id = rowId(row) || getTrainerId(row as Record<string, unknown> | undefined);
  return `${prefix}${id || "row"}-${index}`;
}

/** FlatList `keyExtractor` — always includes index so duplicate ids cannot collide. */
export function flatListKeyExtractor(
  row: { _id?: unknown; id?: unknown },
  index: number
): string {
  return listItemKey(row, index);
}

/** @deprecated Prefer `listItemKey` — kept for call-site compatibility. */
export function trainerListItemKey(
  trainer: Record<string, unknown> | null | undefined,
  index: number,
  prefix = ""
): string {
  return listItemKey(trainer, index, prefix);
}
