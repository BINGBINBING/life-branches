export function researchCoverage(sources, paths) {
  const cases = paths.flatMap((path) => path.cases || []);
  const accepted = new Set(cases.map((item) => item.sourceId));
  const gaps = [];
  if (!cases.some((item) => item.result === 'success')) gaps.push('未找到有阶段依据的正向案例');
  if (!cases.some((item) => item.result === 'setback')) gaps.push('未找到有阶段依据的受挫案例');
  if (paths.length < 2) gaps.push('尚未形成多条可比较的行动路径');
  if (cases.some((item) => item.result === 'unknown')) gaps.push('部分入选案例的阶段结果仍未知');
  return {
    sourceCount: sources.length,
    duplicateCount: sources.filter((source) => source.duplicateOf).length,
    acceptedCount: accepted.size,
    pathCount: paths.length,
    gaps,
  };
}
