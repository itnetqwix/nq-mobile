type NestedSubcategoryGroup = {
  subcategoryId: string | null;
  subcategoryName: string;
  clips: Array<{ _id?: unknown }>;
};

export type NestedCategoryGroupLike = {
  categoryId: string | null;
  categoryName: string;
  subcategories: NestedSubcategoryGroup[];
};

export function dedupeClipsById<T extends { _id?: unknown }>(list: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (let i = 0; i < list.length; i++) {
    const raw = list[i];
    const id = raw?._id != null ? String(raw._id) : `__noid:${i}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(raw);
  }
  return out;
}

/** Dedupe clips inside nested taxonomy groups from API. */
export function dedupeNestedClipGroups<T extends NestedCategoryGroupLike>(groups: T[]): T[] {
  return groups.map((cat) => ({
    ...cat,
    subcategories: (cat.subcategories ?? []).map((sub) => ({
      ...sub,
      clips: dedupeClipsById(sub.clips ?? []),
    })),
  }));
}
