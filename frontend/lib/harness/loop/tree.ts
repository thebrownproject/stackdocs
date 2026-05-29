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

/** Persists the bundle-version tree to agent_bundles. Server-side (service-role db). */
export class SupabaseTreeStore implements TreeStore {
  constructor(
    private db: SupabaseClient,
    private agentId: string,
    private userId: string,
    private evalEpoch: number,
  ) {}

  private async nextVersion(): Promise<number> {
    const { data } = await this.db
      .from("agent_bundles")
      .select("version")
      .eq("agent_id", this.agentId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    return ((data?.version as number | undefined) ?? 0) + 1;
  }

  async insertCandidate(patch: BundlePatch, hypothesis: string, parent: Bundle): Promise<Bundle> {
    const merged = applyBundlePatch(parent, patch);
    const version = await this.nextVersion();
    const candidate: Bundle = {
      version,
      parentVersion: parent.version,
      rules: merged.rules,
      fewShotSampleIds: merged.fewShotSampleIds,
      fieldSchema: merged.fieldSchema,
      status: "candidate",
      score: null,
      hypothesis,
      evalEpoch: this.evalEpoch,
    };
    await this.db.from("agent_bundles").insert({
      agent_id: this.agentId,
      user_id: this.userId,
      version,
      parent_version: parent.version,
      rules: merged.rules,
      few_shot_sample_ids: merged.fewShotSampleIds,
      field_schema: merged.fieldSchema,
      status: "candidate",
      hypothesis,
      eval_epoch: this.evalEpoch,
    });
    return candidate;
  }

  async commit(version: number, score: number): Promise<void> {
    await this.db
      .from("agent_bundles")
      .update({ status: "committed", score })
      .eq("agent_id", this.agentId)
      .eq("version", version);
  }

  async discard(version: number, reason: string): Promise<void> {
    await this.db
      .from("agent_bundles")
      .update({ status: "discarded", hypothesis: reason })
      .eq("agent_id", this.agentId)
      .eq("version", version);
  }
}
