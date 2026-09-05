import test from 'node:test';
import assert from 'node:assert/strict';
import { localApi } from './api.mjs';
import { curatedArchive } from './archive-annotations.mjs';
import { searchQueries } from './engine.mjs';

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
test('historical archive has three validated paths and is explicitly curated', () => {
  const archive = curatedArchive();
  assert.equal(archive.curated, true);
  assert.equal(archive.historical, true);
  assert.equal(archive.result.paths.length, 3);
  assert.equal(archive.result.rejected, 0);
});
test('archive API opens a readable exploration without remote calls', async () => {
  const response = await call('/api/branches/archive');
  assert.equal(response.status, 200);
  assert.equal(response.value.historical, true);
  assert.equal(response.value.status, 'done');
  assert.ok(response.value.result.paths.length > 0);
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
test('search includes supplied background without interpreting it as strict filtering', () => {
  const queries = searchQueries({
    question: '转行开发',
    background: '文科本科',
  });
  assert.equal(queries.length, 2);
  assert.ok(queries.every((q) => q.includes('文科本科')));
});
