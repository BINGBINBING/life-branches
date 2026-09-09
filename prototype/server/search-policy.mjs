import { researchReadiness } from './research-readiness.mjs';

export const SEARCH_ROUNDS = [
  { layer: 'hard_path', purpose: '行动路径与硬条件' },
  { layer: 'adaptive_gap', purpose: '根据首轮缺口补充' },
  { layer: 'outcome', purpose: '阶段结果' },
  { layer: 'constraints', purpose: '限制与成本' },
  { layer: 'retrospective', purpose: '后续回顾' },
];

export function verifiedCoverageReached(result, profile) {
  if (researchReadiness(profile).researchMode !== 'personalized') return false;
  const paths = (result?.paths || []).filter((path) => path.cases?.length);
  const cases = paths.flatMap((path) => path.cases);
  if (paths.length < 2 || new Set(cases.map((item) => item.sourceId)).size < 4) return false;
  if (!cases.some((item) => item.stage?.result === 'success') || !cases.some((item) => item.stage?.result === 'setback')) return false;
  return cases.every((item) => item.stage?.quote && item.action?.quote &&
    item.conditionComparisons?.some((comparison) => ['similar', 'different'].includes(comparison.status)));
}

export function searchStopReason(counts, limit = 5) {
  if (counts.length >= limit) return '已达到本次搜索轮数上限；未找到的经历不代表不存在。';
  if (counts.length >= 3 && counts.at(-1) === counts.at(-2) && counts.at(-2) === counts.at(-3))
    return '连续两轮没有新增有效来源，停止重复检索；这不代表信息已经完整。';
  return '';
}
