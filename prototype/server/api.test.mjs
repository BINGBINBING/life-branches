import test from 'node:test';
import assert from 'node:assert/strict';
import { localApi } from './api.mjs';
import { curatedArchive } from './archive-annotations.mjs';
import {
  adaptiveFollowupQuery,
  expandedSearchTerms,
  searchQueries,
  validProfile,
} from './engine.mjs';

let handler;
localApi().configureServer({
  middlewares: {
    use(fn) {
      handler = fn;
    },
  },
});
async function call(
  url,
  method = 'POST',
  payload = {},
  origin = 'http://localhost:4317',
) {
  let status;
  let value;
  const req = {
    url,
    method,
    headers: {
      host: 'localhost:4317',
      origin,
      'content-type': 'application/json',
    },
    async *[Symbol.asyncIterator]() {
      yield JSON.stringify(payload);
    },
  };
  const res = {
    writeHead(code) {
      status = code;
    },
    end(text) {
      value = JSON.parse(text);
    },
  };
  await handler(req, res, () => {});
  return { status, value };
}
test('historical archive keeps three validated cases and is explicitly curated', () => {
  const archive = curatedArchive();
  assert.equal(archive.curated, true);
  assert.equal(archive.historical, true);
  assert.equal(
    archive.result.paths.reduce((sum, path) => sum + path.cases.length, 0),
    3,
  );
  assert.equal(archive.result.rejected, 0);
});
test('archive API opens a readable exploration without remote calls', async () => {
  const response = await call('/api/branches/archive');
  assert.equal(response.status, 200);
  assert.equal(response.value.historical, true);
  assert.equal(response.value.status, 'done');
  assert.ok(response.value.result.paths.length > 0);
  assert.equal(response.value.result.ruleVersion, 'evidence-3');
  assert.ok(
    response.value.result.paths.every((p) =>
      p.cases.every((c) => c.result === 'unknown'),
    ),
  );
  const read = await call('/api/branches/jobs/' + response.value.id, 'GET');
  assert.equal(read.value.sources.length, 3);
});
test('cross-origin mutations are rejected', async () => {
  assert.equal(
    (await call('/api/branches/archive', 'POST', {}, 'https://unrelated.test'))
      .status,
    403,
  );
});
test('invalid choices do not start remote requests', async () => {
  assert.equal(
    (await call('/api/branches/explore', 'POST', { profile: { question: '' } }))
      .status,
    400,
  );
});
test('unknown previous exploration cannot trigger rematching', async () => {
  assert.equal(
    (
      await call('/api/branches/explore', 'POST', {
        profile: { question: '转行开发' },
        previousId: 'missing',
      })
    ).status,
    400,
  );
});
test('search separates a focused evidence query from a setback query', () => {
  const queries = searchQueries({
    question: '转行开发',
    background: '文科本科',
    decisionScope: 'career_transition',
    conditionAnswers: {
      current_industry: '零售',
      current_job_function: '运营',
      target_industry: '软件',
      target_job_function: '开发',
      daily_time: '每天两小时',
    },
  });
  assert.equal(queries.length, 5);
  assert.match(queries[0], /行业与职能同时变化/);
  assert.match(queries[0], /零售/);
  assert.doesNotMatch(queries[0], /每天两小时/);
  assert.match(queries[1], /失败 被拒 后悔 复盘/);
  assert.match(queries[2], /offer 入职/);
  assert.match(queries[3], /作品 面试 招聘要求/);
  assert.match(queries[4], /薪资 空窗/);
});

test('all four academic routes enter the focused search query', () => {
  const routes = {
    campus_transfer: '校内转专业',
    cross_major_graduate: '跨专业读研',
    minor: '辅修',
    second_bachelor: '第二学士学位',
  };
  for (const [decisionPath, label] of Object.entries(routes)) {
    const [query] = searchQueries({
      question: '我在考虑一个学业选择',
      decisionScope: 'major_transition',
      decisionPath,
      conditionAnswers: {},
    });
    assert.match(query, new RegExp(label));
  }
});

test('second search broadens low recall and tightens noisy recall', () => {
  const profile = {
    question: '从运营转行开发',
    decisionScope: 'career_transition',
    conditionAnswers: {
      target_industry: '软件',
      target_job_function: '开发',
    },
  };
  assert.match(adaptiveFollowupQuery(profile, []), /经历 结果 复盘/);
  const noisy = Array.from({ length: 5 }, (_, index) => ({
    title: `无关经历${index}`,
    snippets: ['没有目标岗位信息'],
  }));
  const narrowed = adaptiveFollowupQuery(profile, noisy);
  assert.match(narrowed, /软件 开发/);
  assert.match(narrowed, /亲身 失败 结果/);
});

test('healthy recall adds controlled expansion terms to the gap query', () => {
  const profile = {
    question: '从运营转行开发',
    decisionScope: 'career_transition',
    conditionAnswers: {
      target_industry: '软件',
      target_job_function: '开发',
      portfolio_or_work_sample: '否',
      income_continuity: '是',
    },
  };
  assert.deepEqual(expandedSearchTerms(profile), ['作品 项目', '在职准备']);
  const focused = Array.from({ length: 5 }, (_, index) => ({
    title: `软件开发经历${index}`,
    snippets: ['从其他行业转行软件开发'],
  }));
  const query = adaptiveFollowupQuery(profile, focused);
  assert.match(query, /作品 项目/);
  assert.match(query, /在职准备/);
  assert.match(query, /失败 被拒 后悔 复盘/);
});

test('profile only accepts condition dictionary ids', () => {
  const profile = validProfile({
    question: '转行开发',
    conditionAnswers: { daily_time: '每天两小时' },
    decisionScope: 'career_transition',
  });
  assert.equal(profile.conditionAnswers.daily_time, '每天两小时');
  assert.throws(() =>
    validProfile({
      question: '转行开发',
      conditionAnswers: { invented_condition: '伪造值' },
    }),
  );
});
