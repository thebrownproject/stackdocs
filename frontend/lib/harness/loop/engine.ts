// The orchestrator loop: greedy hill-climb. Pure control flow over injected
// evaluator/mutator/tree, so it is fully unit-testable with no API calls.
import { compareScores } from "./tree";
import type { Bundle, ExperimentResult, LoopConfig, LoopDeps, LoopEvent, SealedEvaluator } from "./types";

export async function* runLoop(args: {
  config: LoopConfig;
  sealed: SealedEvaluator;
  best: Bundle;
  baselineResult: ExperimentResult;
  deps: LoopDeps;
}): AsyncGenerator<LoopEvent> {
  const { config, sealed, deps } = args;
  let best = args.best;
  let lastResult = args.baselineResult;
  const whatNotToTry: string[] = [];
  let stall = 0;
  let experiments = 0;
  const started = deps.now();

  while (
    stall < config.stallLimit &&
    experiments < config.maxIterations &&
    deps.now() - started < config.maxWallClockMs
  ) {
    const proposal = await deps.mutator({ best, sealed, lastResult, whatNotToTry });
    const candidate = await deps.tree.insertCandidate(proposal.patch, proposal.hypothesis, best);
    yield { type: "experiment_started", version: candidate.version, hypothesis: proposal.hypothesis, parentVersion: candidate.parentVersion };

    const result = await deps.evaluator(candidate, sealed);
    experiments += 1;
    yield { type: "scored", version: candidate.version, score: result.score, perField: result.perField };
    yield { type: "gate_results", version: candidate.version, gateResults: result.gateResults };

    if (!result.passed) {
      await deps.tree.discard(candidate.version, "gate_failed");
      whatNotToTry.push(proposal.hypothesis);
      stall += 1;
      yield { type: "discarded", version: candidate.version, reason: "gate_failed", hypothesis: proposal.hypothesis };
      yield { type: "stalled", round: stall };
      continue;
    }

    if (compareScores(result.score, best.score ?? 0, config.epsilon)) {
      await deps.tree.commit(candidate.version, result.score);
      best = { ...candidate, status: "committed", score: result.score };
      lastResult = result;
      stall = 0;
      yield { type: "committed", version: candidate.version, score: result.score, hypothesis: proposal.hypothesis };
    } else {
      await deps.tree.discard(candidate.version, "no_improvement");
      whatNotToTry.push(proposal.hypothesis);
      stall += 1;
      yield { type: "discarded", version: candidate.version, reason: "no_improvement", hypothesis: proposal.hypothesis };
      yield { type: "stalled", round: stall };
    }
  }

  yield { type: "complete", bestVersion: best.version, bestScore: best.score, experiments };
}
