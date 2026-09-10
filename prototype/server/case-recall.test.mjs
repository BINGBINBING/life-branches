import assert from 'node:assert/strict';
import test from 'node:test';
import { analyze, validProfile } from './engine.mjs';

const profile = validProfile({ question: '校内转专业', decisionScope: 'major_transition', decisionPath: 'campus_transfer' });
const sources = Array.from({ length: 43 }, (_, i) => ({
  id: `S${i + 1}`, title: '虚构转专业材料',
  snippets: [i === 39 ? '你要是喜欢就去蹭课。' : '我申请了降级转专业，参加了转专业笔试。'],
}));
const candidate = (id, advice = false) => ({ sourceId: id, action: {
  text: advice ? '建议旁听喜欢的课程' : '申请降级转专业并参加笔试',
  quote: advice ? sources[39].snippets[0] : sources[0].snippets[0],
} });

test('43 sources: rejected advice triggers bounded recovery and rebuilds case counts', async () => {
  let extraction = 0, calls = 0;
  const result = await analyze(sources, profile, () => {}, { ask: async (prompt) => {
    calls++;
    const metadata = { usage: { total_tokens: 10 } };
    if (prompt.startsWith('你是独立内容分类')) {
      const ids = extraction === 1 ? ['S40'] : ['S2', 'S3', 'S36'];
      return { metadata, value: { reviews: ids.map((id) => ({ id: `${id}:action`, supported: extraction !== 1, contentType: extraction === 1 ? 'advice' : 'actual_action' })) } };
    }
    extraction++;
    if (extraction === 2) assert.match(prompt, /这是低召回补查/);
    return { metadata, value: { paths: [{ cases: extraction === 1 ? [candidate('S40', true)] : ['S2', 'S3', 'S36'].map((id) => candidate(id)) }],
      screening: sources.map((s) => ({ sourceId: s.id, reason: '片段缺少明确个人行动' })) } };
  } });
  assert.equal(calls, 4);
  assert.equal(result.analysis.calls, 4);
  assert.equal(result.analysis.usage.total_tokens, 40);
  assert.equal(result.analysis.recovery.status, 'recovered');
  assert.equal(result.coverage.acceptedCount, 3);
  assert.deepEqual(result.paths.flatMap((p) => p.cases.map((c) => c.sourceId)), ['S2', 'S3', 'S36']);
  assert.equal(result.sourceDispositions.filter((s) => s.accepted).length, 3);
  assert.match(result.sourceDispositions.find((s) => s.sourceId === 'S1').reason, /模型初筛/);
  assert.equal(result.insights.some((i) => i.sourceId === 'S40'), false);
});

test('failed recovery preserves sources and does not retry or accept rejected action', async () => {
  let calls = 0;
  const result = await analyze(sources, profile, () => {}, { ask: async () => {
    calls++;
    if (calls === 1) return { value: { paths: [{ cases: [candidate('S40', true)] }] } };
    if (calls === 2) return { value: { reviews: [{ id: 'S40:action', supported: false, contentType: 'advice' }] } };
    throw new Error('timeout');
  } });
  assert.equal(calls, 3);
  assert.equal(result.analysis.recovery.status, 'failed');
  assert.equal(result.analysis.calls, 3);
  assert.equal(result.coverage.acceptedCount, 0);
  assert.equal(result.sourceDispositions.length, 43);
  assert.equal(result.questions.some((q) => q.sourceId), false);
});

test('all eight approved cases may belong to one action path', async () => {
  const ids = Array.from({ length: 8 }, (_, i) => `S${i + 1}`);
  let calls = 0;
  const result = await analyze(sources, profile, () => {}, { ask: async () => {
    calls++;
    return { value: calls === 1 ? { paths: [{ cases: ids.map((id) => candidate(id)) }] }
      : { reviews: ids.map((id) => ({ id: `${id}:action`, supported: true, contentType: 'actual_action' })) } };
  } });
  assert.equal(calls, 2);
  assert.equal(result.coverage.acceptedCount, 8);
  assert.equal(result.analysis.recovery.status, 'not_needed');
});

test('excerpt references bind original text, never a model-rewritten quote', async () => {
  let calls = 0;
  const result = await analyze(sources.slice(0, 2), profile, () => {}, { ask: async (prompt) => {
    calls++;
    if (calls === 1) return { value: { paths: [{ cases: [
      { sourceId: 'S1', action: { text: '申请降级转专业并参加笔试', excerptIndex: 0, quote: '被模型改写的引文' } },
      { sourceId: 'S2', action: { text: '申请降级转专业', excerptIndex: 99, quote: sources[0].snippets[0] } },
    ] }] } };
    assert.ok(prompt.includes(sources[0].snippets[0]));
    assert.equal(prompt.includes('被模型改写的引文'), false);
    return { value: { reviews: [{ id: 'S1:action', supported: true, contentType: 'actual_action' }] } };
  } });
  assert.equal(result.coverage.acceptedCount, 1);
  assert.equal(result.paths[0].cases[0].action.quote, sources[0].snippets[0]);
  assert.match(result.sourceDispositions[1].reason, /行动引文未通过/);
});
