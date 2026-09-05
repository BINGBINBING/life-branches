import { mkdir, writeFile } from 'node:fs/promises';
import { analyze } from './engine.mjs';
import { sources, profile } from './archive-sources.mjs';
const result = await analyze(sources, profile, console.log);
if (!result.paths.length)
  throw new Error('Model did not produce evidence-backed paths');
await mkdir('.local', { recursive: true });
await writeFile(
  '.local/archive.json',
  JSON.stringify(
    {
      status: 'done',
      progress: '历史样本',
      profile,
      sources,
      result,
      error: null,
      reused: true,
      historical: true,
      retrievedAt: '2026-09-05',
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    paths: result.paths.map((p) => ({ name: p.name, cases: p.cases })),
    questions: result.questions,
    rejected: result.rejected,
  }),
);
