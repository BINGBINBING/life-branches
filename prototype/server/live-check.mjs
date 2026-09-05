import { mkdir, writeFile } from 'node:fs/promises';

const root = process.env.BRANCH_TEST_URL || 'http://localhost:4317';
// All profile fields below are invented test fixtures, not the user's data.
const profile = {
  question: '非科班转行程序员',
  background: '虚构测试人物（非真实用户）：文科本科，在职，没有编程基础',
  time: '虚构测试条件：每天两小时',
  goal: '虚构测试目标：半年内找到开发工作，不能中断收入',
  answers: {},
  skipped: [],
};
async function request(path, input) {
  const response = await fetch(
    root + path,
    input
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }
      : undefined,
  );
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}
async function run(input) {
  const { id } = await request('/api/branches/explore', input);
  for (let i = 0; i < 200; i++) {
    const job = await request('/api/branches/jobs/' + id);
    if (i % 10 === 0) console.log(job.progress);
    if (job.status !== 'running') {
      await mkdir('.local', { recursive: true });
      await writeFile(`.local/${id}.json`, JSON.stringify(job, null, 2));
      console.log(
        JSON.stringify({
          id,
          status: job.status,
          error: job.error,
          sources: job.sources.length,
          reused: job.reused,
          paths: job.result?.paths.map((p) => ({
            name: p.name,
            cases: p.cases.map((c) => ({
              id: c.id,
              result: c.result,
              comparison: c.comparison,
            })),
          })),
          questions: job.result?.questions,
          rejected: job.result?.rejected,
        }),
      );
      if (job.status === 'error') throw new Error(job.error);
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error('Live check timed out');
}
const first = await run({ profile });
if (!first.result.paths.length)
  throw new Error('No evidence-backed paths returned');
const followup = first.result.questions[0];
const next = {
  ...profile,
  background: '虚构测试人物（非真实用户）：文科本科，现已离职，没有编程基础',
  time: '虚构测试条件：每天八小时，暂时可以脱产',
  goal: '虚构测试目标：半年内找到开发工作，已准备半年生活费，允许暂时没有收入',
  answers: followup
    ? {
        [followup.question]: `虚构测试回答：${followup.options[0] || '目前没有相关资源'}`,
      }
    : {},
};
const second = await run({ profile: next, previousId: first.id });
if (JSON.stringify(first.sources) !== JSON.stringify(second.sources))
  throw new Error('Rematching did not reuse evidence');
if (!second.result.paths.length)
  throw new Error('Rematching returned no paths');
if (
  followup &&
  second.result.questions.some((q) => q.question === followup.question)
)
  throw new Error('Already answered question repeated');
await writeFile(
  '.local/live-verification-latest.json',
  JSON.stringify({ first, second }, null, 2),
);
console.log(
  'PASS: live search, validated analysis and rematch with source reuse',
);
