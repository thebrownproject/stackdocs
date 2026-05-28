// Deterministic field scorers — the measurement spine of the harness.
// No LLM judging: scoring must be reproducible so the accuracy number is trustworthy.

import type { FieldType } from "./types";

const FUZZY_THRESHOLD = 0.85;

export const MISSING = Symbol("missing");
export type MaybeValue = unknown | typeof MISSING;

function isMissing(v: MaybeValue): boolean {
  return v === MISSING || v === null || v === undefined || v === "";
}

function normStr(v: unknown): string {
  return String(v).trim().toLowerCase().replace(/\s+/g, " ");
}

/** Strip currency/grouping symbols and parse a number. Returns null if not numeric. */
function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Parse a date to an ISO date string (yyyy-mm-dd), or null. Numeric d/m/y is
 *  read day-first (AU/intl convention); ISO and named-month formats fall through
 *  to Date.parse. */
function parseDate(v: unknown): string | null {
  const s = String(v).trim();
  if (!s) return null;

  // ISO yyyy-mm-dd (and timestamps): trust Date.parse.
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
  }

  // dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy — parse day-first, before Date.parse
  // (which would read slash dates as US month-first).
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const [, d, mo, rawY] = m;
    const y = rawY.length === 2 ? "20" + rawY : rawY;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d));
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
  }

  // Named months etc. ("5 Jan 2026").
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

function tokenSet(v: unknown): Set<string> {
  // Split on any non-alphanumeric so "hi-vis" === "hi vis".
  return new Set(
    String(v)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
}

/** Jaccard similarity over token sets, 0..1. */
function tokenSimilarity(a: unknown, b: unknown): number {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

type Scorer = (expected: MaybeValue, actual: MaybeValue) => boolean;

const exactScorer: Scorer = (e, a) => {
  if (isMissing(e) || isMissing(a)) return isMissing(e) && isMissing(a);
  return normStr(e) === normStr(a);
};

const numericScorer: Scorer = (e, a) => {
  if (isMissing(e) || isMissing(a)) return isMissing(e) && isMissing(a);
  const ne = parseNumber(e);
  const na = parseNumber(a);
  if (ne === null || na === null) return false;
  const tol = Math.max(0.01, Math.abs(ne) * 1e-6);
  return Math.abs(ne - na) <= tol;
};

const dateScorer: Scorer = (e, a) => {
  if (isMissing(e) || isMissing(a)) return isMissing(e) && isMissing(a);
  const de = parseDate(e);
  const da = parseDate(a);
  if (de === null || da === null) return false;
  return de === da;
};

const fuzzyScorer: Scorer = (e, a) => {
  if (isMissing(e) || isMissing(a)) return isMissing(e) && isMissing(a);
  return tokenSimilarity(e, a) >= FUZZY_THRESHOLD;
};

// Pass when presence agrees: both present or both absent.
const presenceScorer: Scorer = (e, a) => isMissing(e) === isMissing(a);

const SCORERS: Record<FieldType, Scorer> = {
  exact: exactScorer,
  numeric: numericScorer,
  date: dateScorer,
  fuzzy: fuzzyScorer,
  presence: presenceScorer,
};

export function score(type: FieldType, expected: MaybeValue, actual: MaybeValue): boolean {
  return SCORERS[type](expected, actual);
}

export const __test = { parseNumber, parseDate, tokenSimilarity, normStr };
