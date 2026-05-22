/** Trainee sport interests from profile (`interests[]` on user). */
export function getTraineeInterests(user: Record<string, unknown> | null | undefined): string[] {
  const raw = user?.interests;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && c !== "Choose Category");
}

/** Categories shown on dashboard: profile interests first, else full master list. */
export function resolveTraineeDashboardCategories(
  interests: string[],
  masterSports: string[]
): string[] {
  if (interests.length > 0) {
    const masterSet = new Set(masterSports.map((s) => s.toLowerCase()));
    const ordered = interests.filter((i) => masterSet.has(i.toLowerCase()) || masterSports.length === 0);
    const extra = interests.filter((i) => !ordered.includes(i));
    return [...ordered, ...extra];
  }
  return masterSports;
}
