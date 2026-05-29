// Bundle-version tree: pure helpers + Supabase-backed persistence.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bundle, BundlePatch, TreeStore } from "./types";

/** Keep a candidate only if it beats parent by at least epsilon (noise guard). */
export function compareScores(candidate: number, parent: number, epsilon: number): boolean {
  return candidate >= parent + epsilon;
}

type MutableBundleFields = Pick<Bundle, "rules" | "fewShotSampleIds" | "fieldSchema">;

/** Apply a typed patch onto a parent bundle, returning the mutated mutable fields. */
export function applyBundlePatch(parent: Bundle, patch: BundlePatch): MutableBundleFields {
  const rules = patch.rules !== undefined ? patch.rules : parent.rules;
  const fewShotSampleIds = patch.fewShotSampleIds ?? parent.fewShotSampleIds;
  let fieldSchema = parent.fieldSchema;
  if (patch.schemaHints && patch.schemaHints.length > 0) {
    fieldSchema = parent.fieldSchema.map((f) => {
      const hint = patch.schemaHints!.find((h) => h.field === f.name);
      if (!hint) return f;
      return {
        ...f,
        type: hint.type ?? f.type,
        required: hint.required ?? f.required,
      };
    });
  }
  return { rules, fewShotSampleIds, fieldSchema };
}
