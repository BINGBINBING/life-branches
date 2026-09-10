import test from 'node:test';
import assert from 'node:assert/strict';
import { deepseekJSON, requiredQuotaIds, parseModelJSON } from './deepseek.mjs';

test('only harmless outer wrappers are normalized, broken JSON is not guessed', () => {
  assert.deepEqual(parseModelJSON('\uFEFF```json\n{"ok":true}\n```'), { ok: true });
  assert.throws(() => parseModelJSON('explanation {"ok":true}'));
  assert.throws(() => parseModelJSON('{"ok":true,}'));
});

test('one explicit repair accounts for both calls and keeps diagnostics content-free', async () => {
  let calls = 0;
  const records = [];
  const result = await deepseekJSON('test', { key: 'test-only', repairJson: true,
    onDiagnostic: async (record) => records.push(record),
    fetcher: async () => ++calls === 1 ? ok('{"secret":"PRIVATE",}') : ok('{"secret":"PRIVATE"}'),
  });
  assert.equal(calls, 2);
  assert.equal(result.metadata.extraCalls, 1);
  assert.equal(result.metadata.usage.prompt_tokens, 20);
  assert.equal(JSON.stringify(records).includes('PRIVATE'), false);
});

test('failed format repair never loops and output truncation never triggers repair', async () => {
  let calls = 0;
  await assert.rejects(deepseekJSON('test', { key: 'test-only', repairJson: true,
    fetcher: async () => { calls++; return ok('broken'); },
  }), /一次格式修复/);
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(deepseekJSON('test', { key: 'test-only', repairJson: true,
    fetcher: async () => { calls++; return ok('{', 'length'); },
  }), /未完整结束/);
  assert.equal(calls, 1);
});

const ok = (content = '{"ok":true}', finish = 'stop') =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content }, finish_reason: finish }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }),
  );
test('extraction output allowance is configurable and capped independently of review defaults', async () => {
  for (const [maxTokens, expected] of [[undefined, 6000], [12000, 12000], [99999, 12000], [-1, 6000]]) {
    await deepseekJSON('test', { key: 'test-only', maxTokens, fetcher: async (_url, init) => {
      assert.equal(JSON.parse(init.body).max_tokens, expected);
      return ok();
    } });
  }
});
test('DeepSeek request is bounded and structured, returns usage without credentials', async () => {
  const result = await deepseekJSON('JSON test', {
    key: 'test-only',
    fetcher: async (url, init) => {
      assert.equal(url, 'https://api.deepseek.com/chat/completions');
      assert.equal(init.redirect, 'error');
      assert.equal(JSON.parse(init.body).response_format.type, 'json_object');
      assert.ok(init.signal);
      return ok();
    },
  });
  assert.equal(result.value.ok, true);
  assert.equal(result.metadata.usage.prompt_tokens, 10);
  assert.ok(!JSON.stringify(result).includes('test-only'));
});
for (const status of [401, 402, 429, 500])
  test(`sanitizes HTTP ${status}`, async () => {
    await assert.rejects(
      deepseekJSON('test', {
        key: 'test-only',
        fetcher: async () => new Response('SECRET', { status }),
      }),
      (e) => !e.message.includes('SECRET'),
    );
  });
for (const [content, finish] of [
  ['not JSON', 'stop'],
  ['[]', 'stop'],
  ['{}', 'length'],
])
  test(`rejects invalid output ${content}/${finish}`, async () => {
    await assert.rejects(
      deepseekJSON('test', {
        key: 'test-only',
        fetcher: async () => ok(content, finish),
      }),
    );
  });
test('timeout aborts request without leaking transport details', async () => {
  await assert.rejects(
    deepseekJSON('test', {
      key: 'test-only',
      timeoutMs: 10,
      fetcher: async (_u, init) =>
        new Promise((_resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error('timeout did not fire')),
            1000,
          );
          init.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('SECRET'));
          });
        }),
    }),
    /请求超时/,
  );
});
test('DeepSeek rematch does not require Zhihu answer quota', () => {
  const old = process.env.ANALYSIS_PROVIDER;
  try {
    process.env.ANALYSIS_PROVIDER = 'deepseek';
    assert.deepEqual(requiredQuotaIds(true), []);
    assert.deepEqual(requiredQuotaIds(false), ['zhihu_search']);
  } finally {
    if (old === undefined) delete process.env.ANALYSIS_PROVIDER;
    else process.env.ANALYSIS_PROVIDER = old;
  }
});
