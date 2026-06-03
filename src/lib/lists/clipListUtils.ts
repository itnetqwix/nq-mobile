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

/** Flat list for booking-wizard clip pickers (locker → session attach). */
export type PickerClipRow = {
  _id: string;
  title?: string;
  name?: string;
  category?: string;
  thumbnail?: string;
  file_name?: string;
};

export function flattenNestedClipsForPicker(groups: NestedCategoryGroupLike[]): PickerClipRow[] {
  const out: PickerClipRow[] = [];
  for (const cat of groups ?? []) {
    const categoryName = cat.categoryName?.trim() ?? "";
    for (const sub of cat.subcategories ?? []) {
      const subName = sub.subcategoryName?.trim() ?? "";
      for (const clip of sub.clips ?? []) {
        const id = clip._id != null ? String(clip._id) : "";
        if (!id) continue;
        const row = clip as Record<string, unknown>;
        out.push({
          _id: id,
          title: typeof row.title === "string" ? row.title : undefined,
          name: typeof row.name === "string" ? row.name : undefined,
          thumbnail: typeof row.thumbnail === "string" ? row.thumbnail : undefined,
          file_name: typeof row.file_name === "string" ? row.file_name : undefined,
          category: categoryName || subName || undefined,
        });
      }
    }
  }
  return dedupeClipsById(out);
}
