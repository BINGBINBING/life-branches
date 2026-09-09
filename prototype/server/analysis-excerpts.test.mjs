import assert from 'node:assert/strict';
import test from 'node:test';
import { analysisExcerpts } from './analysis-excerpts.mjs';

test('analysis sees later action and result paragraphs without joining quotes', () => {
  const text = `${'介绍背景'.repeat(200)}\n我补修了先修课程。\n申请转专业后，我最终获批。\n补充说明`;
  const excerpts = analysisExcerpts([text]);
  assert.ok(excerpts.includes('我补修了先修课程。'));
  assert.ok(excerpts.includes('申请转专业后，我最终获批。'));
  assert.ok(excerpts.every((quote) => text.includes(quote)));
  assert.ok(excerpts.every((quote) => quote.length <= 600));
  assert.ok(excerpts.length <= 4);
});

test('excerpt selection is bounded, deterministic and deduplicated', () => {
  const text = Array.from({ length: 50 }, (_, i) => `我申请${i}次后被拒。`).join('\n');
  const one = analysisExcerpts([text, text]);
  assert.equal(one.length, 4);
  assert.equal(new Set(one).size, 4);
  assert.deepEqual(one, analysisExcerpts([text, text]));
  assert.deepEqual(analysisExcerpts([null, '', '\n']), []);
  assert.deepEqual(analysisExcerpts(['简短的完整片段']), ['简短的完整片段']);
  const mixed = analysisExcerpts([`${text}\n我补修了课程`]);
  assert.ok(mixed.includes('我补修了课程'));
});
