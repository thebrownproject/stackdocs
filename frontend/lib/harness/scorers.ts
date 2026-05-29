// Deterministic field scorers — the measurement spine of the harness.
// No LLM judging: scoring must be reproducible so the accuracy number is trustworthy.

import type { FieldType } from "./types";

const FUZZY_THRESHOLD = 0.85;
const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

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

function isoDate(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return dt.toISOString().slice(0, 10);
}

/** Parse a date to an ISO date string (yyyy-mm-dd), or null. Numeric d/m/y is
 *  read day-first (AU/intl convention). */
function parseDate(v: unknown): string | null {
  const s = String(v).trim();
  if (!s) return null;

  // ISO yyyy-mm-dd, including timestamps, is already a calendar date prefix.
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  // dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy — parse day-first, before Date.parse
  // (which would read slash dates as US month-first).
  const numeric = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (numeric) {
    const [, d, mo, rawY] = numeric;
    const y = rawY.length === 2 ? "20" + rawY : rawY;
    return isoDate(Number(y), Number(mo), Number(d));
  }

  // Named months such as "5 Jan 2026" should not depend on local timezone.
  const named = s.match(/^(\d{1,2})\s+([a-zA-Z]+)\.?,?\s+(\d{2,4})$/);
  if (named) {
    const [, d, rawMonth, rawY] = named;
    const month = MONTHS[rawMonth.toLowerCase()];
    if (!month) return null;
    const y = rawY.length === 2 ? "20" + rawY : rawY;
    return isoDate(Number(y), month, Number(d));
  }

  return null;
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
