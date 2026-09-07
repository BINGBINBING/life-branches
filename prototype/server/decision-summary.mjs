function comparisonPriority(item) {
  if (item.status === 'different') return 0;
  if (item.status === 'unknown') return 1;
  return 2;
}

function applicability(type, item) {
  const comparison = [...(item.conditionComparisons || [])].sort(
    (a, b) => comparisonPriority(a) - comparisonPriority(b),
  )[0];
  if (!comparison) {
    return type === 'practice'
      ? '这项做法可以作为候选步骤，但目前没有双方同口径条件，不能照搬案例周期或结果。'
      : '来源出现了这项风险，但目前没有双方同口径条件，尚不能判断它与你的相关程度。';
  }
  if (comparison.status === 'different') {
    return type === 'practice'
      ? `这项做法值得参考，但案例的${comparison.label}为${comparison.caseValue}，你为${comparison.userValue}，不能直接照搬其周期或结果。`
      : `案例的${comparison.label}为${comparison.caseValue}，你为${comparison.userValue}。条件不同，这项风险与你有关，但不能直接套用案例中的严重程度。`;
  }
  if (comparison.status === 'similar') {
    return type === 'practice'
      ? `案例与你的${comparison.label}均为${comparison.caseValue}，这项做法更值得优先验证，但单项相同不代表整体条件相同。`
      : `案例与你的${comparison.label}均为${comparison.caseValue}，这项风险值得优先核查，但仍不能据此断定会出现相同结果。`;
  }
  return type === 'practice'
    ? `案例的${comparison.label}为${comparison.caseValue}；你尚未提供同口径信息，做法可以参考，但适用程度仍待确认。`
    : `案例的${comparison.label}为${comparison.caseValue}；你尚未提供同口径信息，因此还不能判断这项风险是否与你相关。`;
}

export function buildDecisionInsights(paths, validatedInsights) {
  const cases = paths.flatMap((path) => path.cases || []);
  const bySource = new Map(cases.map((item) => [item.sourceId, item]));
  const result = [];
  const seen = new Set();

  const add = (insight) => {
    const item = bySource.get(insight.sourceId);
    const key = `${insight.type}:${insight.sourceId}:${insight.quote}`;
    if (!item || seen.has(key)) return;
    if (result.filter((entry) => entry.type === insight.type).length >= 2)
      return;
    result.push({
      ...insight,
      applicability: applicability(insight.type, item),
    });
    seen.add(key);
  };

  for (const insight of validatedInsights) add(insight);
  for (const item of cases) {
    add({
      type: 'practice',
      title: '来源中的可参考做法',
      text: item.action.quote,
      sourceId: item.sourceId,
      quote: item.action.quote,
    });
    if (item.stage?.result === 'setback') {
      add({
        type: 'risk',
        title: '来源中的受挫结果',
        text: item.stage.quote,
        sourceId: item.sourceId,
        quote: item.stage.quote,
      });
    }
  }
  return result;
}
