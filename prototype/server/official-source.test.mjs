import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchOfficialSources,
  validateOfficialUrl,
} from './official-source.mjs';

test('official source only accepts education or government HTTPS hosts', () => {
  assert.equal(
    validateOfficialUrl('https://jwc.example.edu.cn/a').hostname,
    'jwc.example.edu.cn',
  );
  for (const url of [
    'http://jwc.example.edu.cn/a',
    'https://example.com/a',
    'https://edu.cn.evil.test/a',
  ])
    assert.throws(() => validateOfficialUrl(url));
});

test('a school name never acts as an official rule URL', async () => {
  const sources = await fetchOfficialSources(
    {
      decisionScope: 'major_transition',
      conditionAnswers: { institution_name: '示例大学' },
    },
    async () => assert.fail('fetch must not be called without policy_link'),
  );
  assert.deepEqual(sources, []);
});

test('official HTML is extracted separately with year metadata', async () => {
  const sources = await fetchOfficialSources(
    {
      decisionScope: 'major_transition',
      conditionAnswers: { policy_link: 'https://jwc.example.edu.cn/rule' },
    },
    async () =>
      new Response(
        '<html><head><title>2026年转专业通知</title></head><body><main>2026年校内转专业申请安排。申请人须在规定时间提交材料，具体名额和考核方式以学院公告为准。学生应当如实填写申请信息，并按照教务部门公布的流程完成资格审核、材料提交和后续考核。逾期提交的材料不再受理，最终结果以学校正式公示为准。</main></body></html>',
        { headers: { 'content-type': 'text/html' } },
      ),
    async () => [{ address: '203.0.113.10', family: 4 }],
  );
  assert.equal(sources[0].kind, 'official');
  assert.deepEqual(sources[0].years, ['2026']);
  assert.deepEqual(sources[0].documentTypes, ['接收名额', '考核办法', '当年通知']);
  assert.match(sources[0].excerpt, /申请人须/);
});

test('official PDF is size-limited and parsed as a separate source', async () => {
  const sources = await fetchOfficialSources(
    {
      decisionScope: 'major_transition',
      conditionAnswers: { policy_link: 'https://example.edu.cn/rules.pdf' },
    },
    async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/pdf' }),
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }),
    async () => [{ address: '203.0.113.10', family: 4 }],
    async (_buffer, url) => ({
      id: 'O1',
      kind: 'official',
      title: '培养方案.pdf',
      url: url.href,
      host: url.hostname,
      retrievedAt: '2026-09-07T00:00:00.000Z',
      years: ['2026'],
      documentTypes: ['培养方案'],
      excerpt: '官方培养方案正文',
      text: '官方培养方案正文'.repeat(20),
    }),
  );
  assert.equal(sources[0].title, '培养方案.pdf');
  assert.equal(sources[0].kind, 'official');
});

test('same-host rule attachments are followed with a strict allowlist', async () => {
  const main = `
    <html><head><title>2026年转专业通知</title></head><body><main>
      2026年校内转专业申请安排，请学生按规定提交材料并参加资格审核。学院将根据学校当年通知组织材料审核、考核与结果公示，逾期提交的申请不再受理，最终结果以教务处公示为准。
      <a href="/docs/rules.docx">附件1：转专业管理规定</a>
      <a href="https://evil.test/plan.pdf">附件2：培养方案</a>
    </main></body></html>`;
  const calls = [];
  const sources = await fetchOfficialSources(
    {
      decisionScope: 'major_transition',
      conditionAnswers: { policy_link: 'https://jwc.example.edu.cn/rule' },
    },
    async (url) => {
      calls.push(url.href);
      return url.pathname.endsWith('.docx')
        ? new Response(new Uint8Array([1, 2, 3]), {
            headers: {
              'content-type':
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            },
          })
        : new Response(main, { headers: { 'content-type': 'text/html' } });
    },
    async () => [{ address: '203.0.113.10', family: 4 }],
    async () => assert.fail('PDF extractor must not be used'),
    async (_buffer, url, title) => ({
      id: 'temporary',
      kind: 'official',
      title,
      url: url.href,
      host: url.hostname,
      retrievedAt: '2026-09-07T00:00:00.000Z',
      years: ['2026'],
      documentTypes: ['当年通知'],
      excerpt: '管理规定正文',
      text: '管理规定正文'.repeat(20),
    }),
  );
  assert.deepEqual(calls, [
    'https://jwc.example.edu.cn/rule',
    'https://jwc.example.edu.cn/docs/rules.docx',
  ]);
  assert.deepEqual(sources.map((source) => source.id), ['O1', 'O2']);
  assert.match(sources[1].title, /管理规定/);
});

test('official fetch rejects hostnames resolving to private addresses', async () => {
  await assert.rejects(
    () =>
      fetchOfficialSources(
        {
          decisionScope: 'major_transition',
          conditionAnswers: {
            policy_link: 'https://example.edu.cn/rules',
          },
        },
        async () => assert.fail('fetch must not be called'),
        async () => [{ address: '127.0.0.1', family: 4 }],
      ),
    /安全校验/,
  );
});
