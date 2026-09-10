import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPathEvidence, attachPathEvidence } from './path-evidence.mjs';
import { analyze, rematchAnalysis, validProfile } from './engine.mjs';

const supplied = [{ id: 'S1', excerpts: [{ text: '建议先了解接收学院的课程与学分要求，再准备申请材料。' }] }];
const raw = { evidencePaths: [{ name: '校内转专业', items: [{ sourceId: 'S1', excerptIndex: 0,
  type: 'advice', text: '建议核对课程与学分要求后准备申请材料', subject: '未说明', scope: '未说明' }] }] };
const approve = async () => ({ value: { reviews: [{ id: 'E1', supported: true }] } });

test('advice-only source contributes a path without becoming an experience', async () => {
  const evidence = await buildPathEvidence(raw, supplied, approve);
  const result = attachPathEvidence({ paths: [], coverage: {}, sourceDispositions: [{ sourceId: 'S1', accepted: false }] }, evidence);
  assert.equal(result.paths.length, 1);
  assert.equal(result.paths[0].cases.length, 0);
  assert.equal(result.paths[0].evidence[0].type, 'advice');
  assert.equal(result.evidenceCoverage.sourceCount, 1);
  assert.equal(result.sourceDispositions[0].accepted, false);
  assert.equal(result.sourceDispositions[0].contributesEvidence, true);
});

test('invalid citations, copied summaries and invented numbers never reach review', async () => {
  for (const patch of [{ excerptIndex: 99 }, { text: supplied[0].excerpts[0].text }, { text: '需要补修100学分' }, { sourceId: 'missing' }]) {
    const data = structuredClone(raw);
    Object.assign(data.evidencePaths[0].items[0], patch);
    const result = await buildPathEvidence(data, supplied, async () => assert.fail('must not call model'));
    assert.equal(result.paths.length, 0);
  }
});

test('missing, ambiguous and failed reviews never publish candidates', async () => {
  for (const ask of [async () => { throw new Error('timeout'); }, async () => ({ value: {} }),
    async () => ({ value: { reviews: [{ id: 'E1', supported: true }, { id: 'E1', supported: false }] } })]) {
    assert.equal((await buildPathEvidence(raw, supplied, ask)).paths.length, 0);
  }
});

test('different stories in one source are not attached by source id alone', async () => {
  const evidence = await buildPathEvidence(raw, supplied, approve);
  evidence.paths[0].evidence[0].type = 'action';
  const result = attachPathEvidence({ paths: [{ id: 'old', name: '另一段经历', cases: [
    { id: 'C1', sourceId: 'S1', action: { text: '室友转专业', quote: '室友的不同片段' } },
  ] }] }, evidence);
  assert.equal(result.paths[0].cases.length, 0);
  assert.equal(result.paths[1].cases[0].id, 'C1');
});

test('analysis and condition rematch retain evidence-only paths with no extra search', async () => {
  const profile = validProfile({ question: '校内转专业', decisionScope: 'major_transition', decisionPath: 'campus_transfer' });
  const sources = [{ id: 'S1', title: '转专业建议', snippets: [supplied[0].excerpts[0].text] }];
  let calls = 0;
  const result = await analyze(sources, profile, () => {}, { ask: async (prompt) => {
    calls++;
    if (calls === 1) { assert.match(prompt, /evidencePaths/); return { value: { ...raw, paths: [], screening: [] } }; }
    return approve();
  } });
  assert.equal(result.analysis.calls, 2);
  assert.equal(result.paths[0].evidence.length, 1);
  const rematched = rematchAnalysis(result, sources, profile);
  assert.equal(rematched.paths[0].evidence.length, 1);
  assert.equal(rematched.paths[0].cases.length, 0);
  assert.equal(rematched.analysis.calls, 0);
});
