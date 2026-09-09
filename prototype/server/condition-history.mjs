import { dictionaryIndex } from './condition-dictionary.mjs';

function snapshot(profile) {
  return {
    background: profile.background || '',
    time: profile.time || '',
    goal: profile.goal || '',
    ...profile.conditionAnswers,
  };
}

export function conditionHistory(previous, profile, now = Date.now()) {
  const history = structuredClone(previous?.conditionHistory || []);
  if (previous && !history.length) {
    history.push({
      version: 1, at: previous.createdAt, kind: 'legacy',
      values: snapshot(previous.profile), changes: [],
    });
  }
  const before = previous ? snapshot(previous.profile) : {};
  const values = snapshot(profile);
  const changes = [...new Set([...Object.keys(before), ...Object.keys(values)])]
    .filter((id) => (before[id] || '') !== (values[id] || ''))
    .map((id) => {
      const question = previous?.result?.questions?.find((item) =>
        item.conditionId === id &&
        profile.answers?.[item.question] === values[id] &&
        previous.profile.answers?.[item.question] !== values[id],
      );
      return {
        id,
        label: dictionaryIndex.get(id)?.label || { background: '背景', time: '投入', goal: '目标与限制' }[id] || id,
        before: before[id] || '', after: values[id] || '',
        origin: !previous ? 'initial' : question ? question.origin || 'evidence' : 'edit',
        sourceId: question?.sourceId || '', quote: question?.quote || '',
      };
    });
  if (!previous || changes.length) history.push({
    version: history.length + 1, at: now,
    kind: previous ? 'updated' : 'initial', values, changes,
  });
  return history;
}
