// Infer a field schema from sample ground-truth outputs:
// union of leaf paths across samples, with a scorer type inferred per path.

import { flatten } from "./flatten";
import type { FieldSchema, FieldSpec, FieldType, Sample } from "./types";

const DATE_HINT = /(date|dob|issued|expiry|expires|due|created|timestamp)/i;
const ENUM_HINT = /(status|type|category|currency|code|state|country|gender|method)/i;

function looksLikeDate(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
  if (/^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/.test(s)) return true;
  return false;
}

function looksNumeric(v: unknown): boolean {
  if (typeof v === "number") return true;
  if (typeof v !== "string") return false;
  return /^\s*[-+]?[$£€]?\s*[\d,]+(\.\d+)?\s*%?\s*$/.test(v) && /\d/.test(v);
}

function inferType(name: string, values: unknown[]): FieldType {
  const present = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (present.length === 0) return "presence";

  if (DATE_HINT.test(name) || present.every(looksLikeDate)) return "date";
  if (present.every(looksNumeric)) return "numeric";

  if (ENUM_HINT.test(name)) return "exact";

  // Short, low-cardinality strings → exact; long free-text → fuzzy.
  const strings = present.map((v) => String(v));
  const avgLen = strings.reduce((s, x) => s + x.length, 0) / strings.length;
  const distinct = new Set(strings.map((s) => s.toLowerCase().trim())).size;
  if (avgLen <= 24 && distinct <= Math.max(2, present.length * 0.6)) return "exact";
  if (avgLen > 40) return "fuzzy";
  return "exact";
}

export function inferSchema(samples: Sample[]): FieldSchema {
  const valuesByPath = new Map<string, unknown[]>();
  const presenceByPath = new Map<string, number>();
  const n = samples.length;

  for (const s of samples) {
    const flat = flatten(s.expectedOutput ?? {});
    for (const [path, value] of Object.entries(flat)) {
      if (!valuesByPath.has(path)) valuesByPath.set(path, []);
      valuesByPath.get(path)!.push(value);
      if (value !== null && value !== undefined && value !== "") {
        presenceByPath.set(path, (presenceByPath.get(path) ?? 0) + 1);
      }
    }
  }

  const schema: FieldSchema = [];
  for (const [path, values] of valuesByPath) {
    const spec: FieldSpec = {
      name: path,
      type: inferType(path, values),
      required: n > 0 && (presenceByPath.get(path) ?? 0) >= n,
    };
    schema.push(spec);
  }
  schema.sort((a, b) => a.name.localeCompare(b.name));
  return schema;
}
