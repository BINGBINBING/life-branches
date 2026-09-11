import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import {
  developerToolsAllowed,
  localApi,
  resolveAdminPassword,
} from './api.mjs';
import { curatedArchive } from './archive-annotations.mjs';
import {
  adaptiveFollowupQuery,
  expandedSearchTerms,
  researchReadiness,
  searchQueries,
  validProfile,
} from './engine.mjs';

function createHandler(options = {}) {
  let configured;
  const api = localApi(options);
  api.configureServer({
    middlewares: {
      use(fn) {
        configured = fn;
      },
    },
  });
  // 暴露 close()，便于使用临时目录的用例先释放 SQLite 句柄再删除文件（Windows 必需）。
  configured.close = () => api.close();
  return configured;
}

const handler = createHandler();

test('all planned and adaptive queries exclude narrative instructions and calendar years', () => {
  for (const scope of ['major_transition', 'career_transition']) {
    const profile = { decisionScope: scope, decisionPath: scope === 'major_transition' ? 'campus_transfer' : 'career_change', conditionAnswers: {
      institution_name: '北湾大学', current_major: '金融学', target_major: '心理学 2026—2027学年', policy_year: '2026—2027',
      current_industry: '零售', current_job_function: '运营', target_industry: '软件2026年', target_job_function: '开发',
    } };
    const queries = [...searchQueries(profile), ...[[], Array(4).fill({ title: '无关', snippets: ['其他内容'] }), Array(4).fill({ title: '北湾大学 软件2026年', snippets: ['心理学'] })].map((sources) => adaptiveFollowupQuery(profile, sources))];
    for (const query of queries) {
      assert.doesNotMatch(query, /亲身|行动|结果|2026|2027|学年/);
      assert.equal(query.split(' ').length, new Set(query.split(' ')).size);
    }
    assert.equal(profile.conditionAnswers.policy_year, '2026—2027');
  }
});

test('local reanalysis restores expired browser sources without searching', async () => {
  let calls = 0;
  const target = createHandler({ analyze: async (sources) => { calls++; assert.equal(sources[0].secret, undefined); return { paths: [], insights: [], questions: [] }; } });
  const payload = { profile: { question: '我想从机械转专业到计算机' }, sources: [{ id: 'S1', url: 'https://www.zhihu.com/question/1', snippets: ['虚构测试片段'], secret: 'not-forwarded' }] };
  const response = await call('/api/branches/reanalyze', 'POST', payload, 'http://localhost:4317', target);
  assert.equal(response.status, 200);
  assert.equal(response.value.metrics.searchCalls, 0);
  assert.equal(calls, 1);
  assert.equal((await call(`/api/branches/jobs/${response.value.id}`, 'GET', {}, 'http://localhost:4317', target)).status, 200);
  assert.equal((await call('/api/branches/reanalyze', 'POST', payload, 'https://public.test', target, 'public.test')).status, 403);
});

test('diagnostic snapshots deny public hosts, production and cross-site requests', async () => {
  const endpoint = '/api/branches/diagnostic-snapshot';
  assert.equal((await call(endpoint, 'POST', {}, 'https://example.test', handler, 'example.test')).status, 403);
  assert.equal((await call(endpoint, 'POST', {}, 'http://evil.test')).status, 403);
  assert.equal((await call(endpoint, 'POST', {}, 'http://localhost:4317', createHandler({ env: { NODE_ENV: 'production' } }))).status, 403);
});

test('diagnostic endpoint persists only requested metadata', async () => {
  const { mkdtemp, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const directory = await mkdtemp(join(tmpdir(), 'diagnostics-api-'));
  try {
    const result = await call('/api/branches/diagnostic-snapshot', 'POST', { researchId: 'job-1', apiKey: 'never-store' }, 'http://localhost:4317', createHandler({ diagnosticDirectory: directory }));
    assert.equal(result.status, 200);
    const saved = await readFile(join(directory, 'latest.json'), 'utf8');
    assert.ok(saved.includes('job-1'));
    assert.ok(!saved.includes('never-store'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('production feedback deletion only removes the current session feedback', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const directory = await mkdtemp(join(tmpdir(), 'feedback-api-'));
  const target = createHandler({ env: { NODE_ENV: 'production' }, researchStorePath: join(directory, 'research.sqlite'), budgetPath: join(directory, 'budget.sqlite') });
  try {
    const a = await call('/api/branches/feedback', 'POST', { rating: 4, comment: '虚构反馈A' }, 'https://example.test', target, 'example.test');
    const b = await call('/api/branches/feedback', 'POST', { rating: 3, comment: '虚构反馈B' }, 'https://example.test', target, 'example.test');
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    for (const session of [a, b]) {
      const cookie = session.headers['Set-Cookie'].split(';')[0];
      const removed = await call('/api/branches/feedback', 'DELETE', {}, 'https://example.test', target, 'example.test', cookie);
      assert.equal(removed.value.removed, 1);
      assert.equal((await call('/api/branches/feedback', 'DELETE', {}, 'https://example.test', target, 'example.test', cookie)).value.removed, 0);
    }
    assert.equal((await call('/api/branches/feedback', 'DELETE')).status, 409);
  } finally { target.close(); await rm(directory, { recursive: true, force: true }); }
});
async function call(
  url,
  method = 'POST',
  payload = {},
  origin = 'http://localhost:4317',
  targetHandler = handler,
  host = 'localhost:4317',
  cookie = '',
  extraHeaders = {},
) {
  let status;
  let value;
  const responseHeaders = {};
  const req = {
    url,
    method,
    headers: {
      host,
      origin,
      'content-type': 'application/json',
      cookie,
      ...extraHeaders,
    },
    async *[Symbol.asyncIterator]() {
      yield JSON.stringify(payload);
    },
  };
  const res = {
    setHeader(name, value) { responseHeaders[name] = value; },
    writeHead(code) {
      status = code;
    },
    end(text) {
      value = JSON.parse(text);
    },
  };
  await targetHandler(req, res, () => {});
  return { status, value, headers: responseHeaders };
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
  assert.equal(response.value.result.ruleVersion, 'evidence-6-path-evidence');
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

test('production jobs are isolated by a secure anonymous session cookie', async () => {
  const production = createHandler({ env: { NODE_ENV: 'production' } });
  const opened = await call('/api/branches/archive', 'POST', {}, 'https://example.test', production, 'example.test');
  assert.equal(opened.status, 200);
  const cookie = opened.headers['Set-Cookie'].split(';')[0];
  assert.match(opened.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Strict/);
  const url = `/api/branches/jobs/${opened.value.id}`;
  assert.equal((await call(url, 'GET', {}, 'https://example.test', production, 'example.test', cookie)).status, 200);
  assert.equal((await call(url, 'GET', {}, 'https://example.test', production, 'example.test')).status, 404);
  const unauthorized = await call('/api/branches/explore', 'POST', { profile: opened.value.profile, previousId: opened.value.id }, 'https://example.test', production, 'example.test');
  assert.equal(unauthorized.status, 400);
});

test('batch follow-up submission rematches once locally and reuses all sources', async () => {
  const archive = (await call('/api/branches/archive')).value;
  const submitted = {
    ...archive.profile,
    conditionAnswers: { ...archive.profile.conditionAnswers, daily_time: '2小时/天', current_job_function: '运营', target_job_function: '开发' },
    answers: { '每天多久？': '2小时/天', '当前岗位？': '运营' },
  };
  const created = await call('/api/branches/explore', 'POST', { profile: submitted, previousId: archive.id });
  assert.equal(created.status, 202);
  const job = (await call(`/api/branches/jobs/${created.value.id}`, 'GET')).value;
  assert.equal(job.status, 'done');
  assert.equal(job.reused, true);
  assert.deepEqual(job.sources, archive.sources);
  assert.deepEqual(job.profile.conditionAnswers, submitted.conditionAnswers);
  assert.equal(job.metrics.searchCalls, 0);
  assert.equal(job.result.analysis.provider, 'local');
  assert.equal(job.metrics.stages.filter((stage) => stage.stage === 'analysis').length, 1);
});

test('all query variants bound long target values and omit unknown placeholders', () => {
  const profile = { decisionScope: 'career_transition', decisionPath: 'career_change',
    question: '私人叙述不应进入搜索',
    conditionAnswers: { target_job_function: '前端'.repeat(200), target_industry: '尚未核实' },
  };
  const queries = [...searchQueries(profile), adaptiveFollowupQuery(profile,
    Array.from({ length: 4 }, (_, i) => ({ title: `不相关${i}`, snippets: ['别的行业经历'] })))];
  assert.ok(queries.every((q) => q.length < 350));
  assert.ok(queries.every((q) => !q.includes('尚未核实') && !q.includes(profile.question)));
});
test('production never falls back to the development admin password', () => {
  assert.equal(resolveAdminPassword({ NODE_ENV: 'production' }), null);
  assert.equal(
    resolveAdminPassword({
      NODE_ENV: 'production',
      ADMIN_PASSWORD: 'configured-secret',
    }),
    'configured-secret',
  );
  assert.equal(
    resolveAdminPassword({ NODE_ENV: 'development' }),
    'life-branches-dev',
  );
});
test('production disables the admin endpoint when no password is configured', async () => {
  const productionHandler = createHandler({ env: { NODE_ENV: 'production' } });
  const response = await call(
    '/api/branches/admin/summary',
    'GET',
    {},
    'http://localhost:4317',
    productionHandler,
  );
  assert.equal(response.status, 503);
  assert.match(response.value.error, /管理功能未启用/);
});
test('multibyte incorrect admin passwords are rejected without throwing', async () => {
  const target = createHandler({ env: { NODE_ENV: 'production', ADMIN_PASSWORD: 'ab' } });
  for (const password of ['éé', '密码', 'zz', ['ab'], '']) {
    const response = await call('/api/branches/admin/summary', 'GET', {},
      'http://localhost:4317', target, 'localhost:4317', '', { 'x-admin-password': password });
    assert.equal(response.status, 401);
  }
});
test('developer key tools are local-only and disabled in production', async () => {
  assert.equal(
    developerToolsAllowed(
      { headers: { host: '127.0.0.1:4317' } },
      { NODE_ENV: 'development' },
    ),
    true,
  );
  assert.equal(
    developerToolsAllowed(
      { headers: { host: 'public.example' } },
      { NODE_ENV: 'development' },
    ),
    false,
  );
  assert.equal(
    developerToolsAllowed(
      { headers: { host: 'localhost:4317' } },
      { NODE_ENV: 'production' },
    ),
    false,
  );
  const productionHandler = createHandler({ env: { NODE_ENV: 'production' } });
  assert.equal(
    (
      await call(
        '/api/branches/settings',
        'GET',
        {},
        'http://localhost:4317',
        productionHandler,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call(
        '/api/branches/keys',
        'POST',
        { type: 'ai', value: 'secret' },
        'http://localhost:4317',
        productionHandler,
      )
    ).status,
    404,
  );
  const developmentHandler = createHandler({ env: { NODE_ENV: 'development' } });
  assert.equal(
    (
      await call(
        '/api/branches/settings',
        'GET',
        {},
        'https://demo.example',
        developmentHandler,
        'demo.example',
      )
    ).status,
    404,
  );
});
test('invalid choices do not start remote requests', async () => {
  assert.equal(
    (await call('/api/branches/explore', 'POST', { profile: { question: '' } }))
      .status,
    400,
  );
});
test('decision route can be corrected without an AI intake call', async () => {
  const response = await call('/api/branches/intake', 'POST', {
    question: '我想转专业',
    decisionPath: 'minor',
  });
  assert.equal(response.status, 200);
  assert.equal(response.value.path, 'minor');
  assert.equal(response.value.generatedBy, 'local-route-change');
  assert.ok(
    response.value.fields.some(
      (field) => field.id === 'minor_application_eligibility',
    ),
  );
  const [query] = searchQueries({
    decisionScope: response.value.scope,
    decisionPath: response.value.path,
    conditionAnswers: {},
  });
  assert.match(query, /辅修/);
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
test('career search separates role direction, industry context and preparation', () => {
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
  assert.match(queries[0], /转行 转岗/);
  assert.match(queries[0], /从运营转向开发/);
  assert.doesNotMatch(queries[0], /零售|软件/);
  assert.doesNotMatch(queries[0], /每天两小时/);
  assert.match(queries[1], /开发 入门/);
  assert.match(queries[2], /零售 转 软件 转行 招聘/);
  assert.match(queries[3], /作品 面试/);
  assert.match(queries[4], /薪资 空窗/);
});

test('search queries exclude the full personal narrative and stay concise', () => {
  const privateNarrative = '我还没有告诉家人这件事，担心他们反对。'.repeat(30);
  const queries = searchQueries({
    question: `我想从零售运营转行软件开发。${privateNarrative}`,
    decisionScope: 'career_transition',
    decisionPath: 'career_change',
    conditionAnswers: {
      current_industry: '零售',
      current_job_function: '运营',
      target_industry: '软件',
      target_job_function: '开发',
    },
  });
  assert.ok(queries.every((query) => query.length < 260));
  assert.ok(queries.every((query) => !query.includes('没有告诉家人')));
  assert.ok(queries.every((query) => !query.includes(privateNarrative)));
  assert.doesNotMatch(queries[0], /零售/);
  assert.match(queries[2], /零售/);
  assert.match(queries[0], /开发/);
});

test('incomplete industry classification never leaks internal status into search terms', () => {
  const queries = searchQueries({ decisionScope: 'career_transition', conditionAnswers: {
    current_job_function: '运营', target_job_function: '软件开发',
  } });
  for (const query of queries) {
    assert.match(query, /软件开发/);
    assert.doesNotMatch(query, /待确认|当前岗位职能|目标岗位职能|行业与职能变化/);
  }
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
  assert.match(adaptiveFollowupQuery(profile, []), /开发 入门/);
  assert.doesNotMatch(adaptiveFollowupQuery(profile, []), /申请条件|失败|被拒/);
  const noisy = Array.from({ length: 5 }, (_, index) => ({
    title: `无关经历${index}`,
    snippets: ['没有目标岗位信息'],
  }));
  const narrowed = adaptiveFollowupQuery(profile, noisy);
  assert.match(narrowed, /开发/);
  assert.match(narrowed, /岗位/);
});

test('healthy recall explores adaptation without piling personal constraints into queries', () => {
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
  assert.match(query, /适应/);
  assert.doesNotMatch(query, /作品 项目|在职准备|失败 被拒/);
});

test('missing core fields force general research mode', () => {
  assert.deepEqual(
    researchReadiness({
      decisionPath: 'campus_transfer',
      conditionAnswers: { institution_name: '示例大学' },
    }),
    {
      researchMode: 'general',
      missingRequired: ['current_major', 'target_major'],
    },
  );
  assert.equal(
    researchReadiness({
      decisionPath: 'career_change',
      conditionAnswers: {
        current_job_function: '运营',
        target_job_function: '前端',
      },
    }).researchMode,
    'personalized',
  );
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
