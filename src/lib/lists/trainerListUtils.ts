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

/**
 * Drop duplicate Mongo rows by `_id` / `id`, preserving insertion order.
 *
 * The generic accepts any row shape — we cast to the structural id-bearing
 * shape inside the loop so callers passing `Record<string, unknown>` or
 * domain types without an explicit `_id?` field don't have to widen their
 * types just to dedupe. The runtime contract (`row._id` ?? `row.id`)
 * stays identical to before.
 */
export function dedupeRowsById<T>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const id = rowId(row as { _id?: unknown; id?: unknown } | null | undefined);
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

/**
 * FlatList `keyExtractor` — always includes index so duplicate ids cannot
 * collide. The `row` parameter is typed `any` on purpose: when a typed
 * `keyExtractor` is passed to `<FlatList<T>>`, TS otherwise infers `T`
 * from this signature (the narrowest constraint wins), which forces
 * `renderItem({ item })` to that same narrow shape on every list in the
 * app. Accepting `any` lets `FlatList` infer the item type from `data`
 * (where the caller owns the schema) while we still hand off to
 * `listItemKey` for the actual stringification.
 */
export function flatListKeyExtractor(row: any, index: number): string {
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
