/**
 * Lightweight fuzzy matcher for in-app search (FAQ, help, command palette).
 *
 * Goals:
 *   • Catches typos ("paymnt" → "payment") via Levenshtein distance.
 *   • Tolerates word order ("instant lessons join" matches "How to join an
 *     instant lesson").
 *   • Boosts substring + prefix matches so exact queries always win.
 *
 * Not a general-purpose fuzzy library — we stay <2 kB and avoid runtime
 * surprises (no `Trie`, no `IDF` weights). The function is tuned for
 * 20–100-item lists; for thousands of rows reach for `fuse.js` instead.
 */

export type FuzzyHaystack<T> = {
  /** The row payload to return on a match. */
  item: T;
  /** One or more searchable strings. The first is treated as the primary. */
  fields: string[];
};

export type FuzzyHit<T> = {
  item: T;
  score: number;
  /** Per-field hit info — useful for highlighting. */
  matchedField?: string;
};

const MAX_LEVENSHTEIN_DELTA = 2;

function normalise(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1);
  const v1 = new Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v0[b.length];
}

/** Score a single field against a query. Higher is better; 0 means no hit. */
function scoreField(field: string, queryTokens: string[]): number {
  const text = normalise(field);
  if (!text) return 0;

  let total = 0;
  let matched = 0;

  for (const q of queryTokens) {
    if (!q) continue;
    /** Exact substring → strong boost. Prefix → even stronger. */
    if (text.startsWith(q)) {
      matched++;
      total += 1.0;
      continue;
    }
    if (text.includes(q)) {
      matched++;
      total += 0.7;
      continue;
    }
    /** Fuzzy fallback per word — accept if Levenshtein ≤ tolerance. */
    const words = text.split(" ");
    let bestWordScore = 0;
    for (const w of words) {
      if (!w) continue;
      const tolerance = Math.min(MAX_LEVENSHTEIN_DELTA, Math.floor(q.length / 4));
      const d = levenshtein(q, w);
      if (d <= tolerance) {
        const score = Math.max(0, 0.5 - d * 0.1);
        if (score > bestWordScore) bestWordScore = score;
      }
    }
    if (bestWordScore > 0) {
      matched++;
      total += bestWordScore;
    }
  }

  if (matched === 0) return 0;
  /** Require ≥ 60 % of tokens to match — prevents single-token false positives
   *  like "the" matching every row. */
  if (matched / queryTokens.length < 0.6) return 0;
  return total + matched * 0.05;
}

export function fuzzySearch<T>(
  query: string,
  haystack: FuzzyHaystack<T>[],
  options: { limit?: number; fieldWeights?: number[] } = {}
): FuzzyHit<T>[] {
  const norm = normalise(query);
  if (!norm) return haystack.map(({ item }) => ({ item, score: 0 }));
  const tokens = norm.split(" ").filter(Boolean);
  if (!tokens.length) return [];

  const hits: FuzzyHit<T>[] = [];
  for (const row of haystack) {
    let best = 0;
    let bestField: string | undefined;
    row.fields.forEach((field, idx) => {
      const weight = options.fieldWeights?.[idx] ?? (idx === 0 ? 1 : 0.85);
      const s = scoreField(field, tokens) * weight;
      if (s > best) {
        best = s;
        bestField = field;
      }
    });
    if (best > 0) hits.push({ item: row.item, score: best, matchedField: bestField });
  }

  hits.sort((a, b) => b.score - a.score);
  return options.limit ? hits.slice(0, options.limit) : hits;
}
