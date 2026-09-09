import assert from 'node:assert/strict';
import test from 'node:test';
import { runResearch } from './research-runner.mjs';
import { analyze, validProfile } from './engine.mjs';

const profile = validProfile({ question: '校内转专业', decisionScope: 'major_transition', decisionPath: 'campus_transfer', time: '每天2小时', conditionAnswers: { institution_name: '示例大学', current_major: '机械', target_major: '计算机', daily_time: '2小时' } });
const sources = Array.from({ length: 4 }, (_, i) => ({ id: `S${i + 1}`, title: '虚构经历', snippets: [i < 2 ? '我补修了数学先修课程，我的转专业申请获批，我每天学习2小时' : '我参加了转专业笔试，我未通过转专业考核，我每天学习2小时'] }));

for (const [incomplete, newSources] of [[false, false], [true, true], [true, false]]) test(`checkpoint incomplete=${incomplete}, newSources=${newSources}`, async () => {
  let calls = 0, rawCalls = 0, stopReason = '';
  const metrics = [];
  const completed = await runResearch(profile, () => {}, () => {}, (metric) => metrics.push(metric), {
    search: async (_profile, _progress, _sources, _metric, options) => {
      stopReason = await options.onCheckpoint(sources);
      return !newSources || stopReason ? sources : [...sources, { id: 'S5', title: '另一个来源', snippets: ['我想了解转专业'] }];
    },
    analyze: (items, user, progress, options) => analyze(items, user, progress, { ...options, ask: async (prompt) => {
      calls++;
      const metadata = { provider: 'test', usage: { total_tokens: 10 } };
      if (prompt.startsWith('你是独立内容分类与证据审核员')) return { metadata, value: { reviews: sources.map((source) => ({ id: `${source.id}:action`, supported: true, contentType: 'actual_action' })) } };
      rawCalls++;
      const selected = incomplete && rawCalls === 1 ? sources.slice(0, 3) : sources;
      return { metadata, value: { paths: [{ cases: selected.map((source, i) => ({ sourceId: source.id, action: { text: i < 2 ? '补修先修课程' : '参加笔试', quote: source.snippets[0].split('，')[0] }, conditionEvidence: [{ conditionId: 'daily_time', quote: '我每天学习2小时' }] })) }] } };
    } }),
  });
  assert.equal(Boolean(stopReason), !incomplete);
  assert.equal(calls, newSources ? 3 : 2);
  assert.equal(completed.result.analysis.calls, calls);
  assert.equal(completed.result.analysis.usage.total_tokens, calls * 10);
  assert.equal(metrics[0].status, incomplete ? 'continue_search' : 'target_reached');
});
