// Delivery A: drive the autoresearch loop from the terminal against a live
// Supabase + Anthropic stack. Usage:
//   npm run tune -- --agent <agentId> --user <userId> [--iters 30] [--stall 5]
import { createClient } from "@supabase/supabase-js";
import { setupEvaluator } from "../lib/harness/loop/setup";
import { evaluate, makeLiveRunOne } from "../lib/harness/loop/evaluator";
import { proposeMutation, makeLiveGenerate } from "../lib/harness/loop/mutator";
import { SupabaseTreeStore } from "../lib/harness/loop/tree";
import { runLoop } from "../lib/harness/loop/engine";
import type { Bundle, LoopConfig } from "../lib/harness/loop/types";

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`missing --${name}`);
}

async function main() {
  const agentId = arg("agent");
  const userId = arg("user");
  const config: LoopConfig = {
    stallLimit: Number(arg("stall", "5")),
    maxIterations: Number(arg("iters", "30")),
    maxWallClockMs: Number(arg("wallclock", String(2 * 60 * 60 * 1000))),
    epsilon: Number(arg("epsilon", "0.005")),
  };

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  console.log(`Setting up evaluator for agent ${agentId}...`);
  const sealed = await setupEvaluator(db, agentId, userId, {
    strategyDoc: "Extract every field exactly. Prefer document evidence over assumptions.",
  });
  console.log(`Sealed eval epoch ${sealed.evalEpoch}: ${sealed.heldOut.length} held-out, ${sealed.train.length} train, ${sealed.gates.length} gates.`);

  const runOne = makeLiveRunOne(db, agentId);
  const evaluator = (bundle: Bundle, s = sealed) => evaluate(bundle, s, { runOne });

  // Baseline bundle (version 1, no rules) as the root of the tree.
  const tree = new SupabaseTreeStore(db, agentId, userId, sealed.evalEpoch);
  const { data: existing } = await db
    .from("agent_bundles").select("version").eq("agent_id", agentId)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  const baselineVersion = ((existing?.version as number | undefined) ?? 0) + 1;
  await db.from("agent_bundles").insert({
    agent_id: agentId, user_id: userId, version: baselineVersion,
    rules: null, few_shot_sample_ids: sealed.train.slice(0, 3).map((s) => s.id),
    field_schema: sealed.fieldSchema, status: "baseline", eval_epoch: sealed.evalEpoch,
  });
  const baseline: Bundle = {
    version: baselineVersion, parentVersion: null, rules: null,
    fewShotSampleIds: sealed.train.slice(0, 3).map((s) => s.id),
    fieldSchema: sealed.fieldSchema, status: "baseline", score: null,
    hypothesis: null, evalEpoch: sealed.evalEpoch,
  };

  console.log("Running baseline over held-out...");
  const baselineResult = await evaluator(baseline);
  await tree.commit(baselineVersion, baselineResult.score);
  baseline.status = "committed";
  baseline.score = baselineResult.score;
  console.log(`Baseline held-out accuracy: ${(baselineResult.score * 100).toFixed(1)}%`);

  const mutator = (state: Parameters<typeof proposeMutation>[0]) =>
    proposeMutation(state, { generate: makeLiveGenerate() });

  for await (const event of runLoop({
    config, sealed, best: baseline, baselineResult,
    deps: { evaluator, mutator, tree, now: () => Date.now() },
  })) {
    if (event.type === "scored") {
      console.log(`  v${event.version}: ${(event.score * 100).toFixed(1)}%`);
    } else if (event.type === "committed") {
      console.log(`✓ COMMIT v${event.version} ${(event.score * 100).toFixed(1)}% — ${event.hypothesis}`);
    } else if (event.type === "discarded") {
      console.log(`✗ discard v${event.version} (${event.reason})`);
    } else if (event.type === "complete") {
      console.log(`\nDone. Best v${event.bestVersion} @ ${((event.bestScore ?? 0) * 100).toFixed(1)}% over ${event.experiments} experiments.`);
    }
  }

  // Promote best committed bundle.
  const { data: bestBundle } = await db
    .from("agent_bundles").select("version, score")
    .eq("agent_id", agentId).eq("eval_epoch", sealed.evalEpoch).eq("status", "committed")
    .order("score", { ascending: false }).limit(1).maybeSingle();
  if (bestBundle?.version) {
    await db.from("agents").update({
      active_bundle_version: bestBundle.version, status: "trained",
      updated_at: new Date().toISOString(),
    }).eq("id", agentId);
    console.log(`Promoted v${bestBundle.version} as active bundle.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
