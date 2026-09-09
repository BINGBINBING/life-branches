import { analyze, search } from './engine.mjs';
import { verifiedCoverageReached } from './search-policy.mjs';
import { researchReadiness } from './research-readiness.mjs';

export async function runResearch(profile, progress, onSources, onMetric, options = {}) {
  const analyzeFn = options.analyze || analyze;
  const searchFn = options.search || search;
  let checkpoint;
  let analysisElapsedMs = 0;
  const sources = await searchFn(profile, progress, onSources, onMetric, {
    onCheckpoint: async (current) => {
      if (researchReadiness(profile).researchMode !== 'personalized') return '';
      if (current.filter((source) => !source.duplicateOf).length < 4) return '';
      let raw;
      const started = Date.now();
      const result = await analyzeFn(current, profile, progress, {
        deferSummaryReview: true, onRaw(value) { raw = value; },
      });
      analysisElapsedMs += Date.now() - started;
      checkpoint = { raw, result, signature: JSON.stringify(current) };
      const enough = verifiedCoverageReached(result, profile);
      onMetric({ stage: 'coverage_checkpoint', status: enough ? 'target_reached' : 'continue_search', acceptedCases: result.coverage?.acceptedCount || 0 });
      return enough ? '已达到本次样本覆盖目标：多行动分枝、正反阶段及可比条件；提前停止，不代表经历穷尽或结论确定。' : '';
    },
  });
  const unchanged = checkpoint?.raw && checkpoint.signature === JSON.stringify(sources);
  const started = Date.now();
  const result = await analyzeFn(sources, profile, progress, unchanged ? { preloadedRaw: checkpoint.raw } : {});
  analysisElapsedMs += Date.now() - started;
  if (checkpoint && !unchanged && result.analysis) {
    result.analysis.calls += checkpoint.result.analysis?.calls || 1;
    const usage = { ...result.analysis.usage };
    for (const [key, value] of Object.entries(checkpoint.result.analysis?.usage || {}))
      if (Number.isFinite(value)) usage[key] = (usage[key] || 0) + value;
    result.analysis.usage = usage;
  }
  return { sources, result, analysisElapsedMs };
}
