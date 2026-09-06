import { mkdir, writeFile } from 'node:fs/promises';
import { sources, profile } from './archive-sources.mjs';
import { analyze } from './engine.mjs';
import { analysisProvider } from './deepseek.mjs';

if (analysisProvider() !== 'deepseek')
  throw new Error('This verification requires DeepSeek.');
const cases = [
  { name: 'history-two-hours', sources, profile },
  {
    name: 'history-eight-hours',
    sources,
    profile: {
      ...profile,
      time: '虚构示例条件：每天八小时',
      background: '虚构示例人物：文科本科，已离职，没有编程基础',
      goal: '虚构示例目标：半年内找到开发工作，有半年生活费，可暂时脱产',
    },
  },
  {
    name: 'synthetic-two-hours',
    sources: [
      {
        id: 'S1',
        title: '虚构测试经历，不是真实知乎内容',
        snippets: [
          '我是电子信息工程专业毕业的，自学编程每天投入八小时，三个月完成并部署了一个项目。没有说明是否就业，也没有说明入门前编程基础。',
        ],
        author: '虚构测试人物',
      },
    ],
    profile,
  },
];
await mkdir('.local/deepseek-verification', { recursive: true });
for (const item of cases) {
  const result = await analyze(item.sources, item.profile, () => {});
  await writeFile(
    `.local/deepseek-verification/${item.name}.json`,
    JSON.stringify({ ...item, result }, null, 2),
    { mode: 0o600 },
  );
  console.log(JSON.stringify({ name: item.name, ...result }));
}
