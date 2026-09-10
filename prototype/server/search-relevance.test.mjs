import test from 'node:test';
import assert from 'node:assert/strict';
import { searchQueries, adaptiveFollowupQuery } from './engine.mjs';

const profile = { decisionScope: 'major_transition', decisionPath: 'campus_transfer', conditionAnswers: {
  institution_name: '北湾大学', current_major: '金融学', target_major: '心理学',
  current_stage: '大三', gpa_value: '3.71', policy_year: '2026—2027',
} };

test('major direction, target exploration and school rules are independent searches', () => {
  const queries = searchQueries(profile);
  assert.equal(queries.length, 5);
  assert.equal(new Set(queries).size, 5);
  assert.equal(queries[0], '校内转专业 金融学 转心理学');
  assert.deepEqual(queries.filter((q) => q.includes('北湾大学')), ['北湾大学 校内转专业 条件']);
  assert.doesNotMatch(queries[1], /金融学|北湾大学/);
  assert.ok(queries.every((q) => !/亲身|行动|结果|2026|2027|3\.71|大三/.test(q)));
});

test('low recall removes the originating major instead of appending more constraints', () => {
  const query = adaptiveFollowupQuery(profile, []);
  assert.match(query, /心理学/);
  assert.doesNotMatch(query, /金融学|北湾大学|失败|被拒/);
});

test('school mentions do not count as target-major relevance', () => {
  const noisy = Array.from({ length: 5 }, () => ({ title: '北湾大学转专业', snippets: ['计算机专业介绍'] }));
  assert.equal(adaptiveFollowupQuery(profile, noisy), '心理学 校内转专业 课程');
  const focused = Array.from({ length: 5 }, () => ({ title: '心理学学习', snippets: ['相关课程'] }));
  assert.match(adaptiveFollowupQuery(profile, focused), /金融学 转心理学 适应/);
});

test('duplicate sources cannot inflate first-round recall', () => {
  const sources = Array.from({ length: 6 }, (_, i) => ({ title: '心理学', snippets: ['相关课程'], ...(i ? { duplicateOf: 'S1' } : {}) }));
  assert.equal(adaptiveFollowupQuery(profile, sources), searchQueries(profile)[1]);
});
