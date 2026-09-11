// 依赖自检：启动/构建前确认 node_modules 与 package.json、package-lock.json 一致。
//
// 背景：如果 node_modules 是旧的或不完整的（例如直接解压了别人在某次依赖变更
// 之前打包的 node_modules），vite.config.ts 会导入 server/api.mjs，进而导入
// cheerio / pdfjs-dist / mammoth，最终抛出难以定位的
// `ERR_MODULE_NOT_FOUND: Cannot find package 'cheerio'`。
// 这里把这种情况提前变成一条可执行的提示。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

const manifest = readJson(path.join(root, 'package.json'));
if (!manifest) {
  console.error('依赖自检失败：无法读取 package.json。');
  process.exit(1);
}

const lock = readJson(path.join(root, 'package-lock.json'));
const declared = { ...manifest.dependencies, ...manifest.devDependencies };
const problems = [];

for (const name of Object.keys(declared)) {
  const installed = readJson(path.join(root, 'node_modules', name, 'package.json'));
  if (!installed) {
    problems.push(`缺少 ${name}`);
    continue;
  }
  const pinned = lock?.packages?.[`node_modules/${name}`]?.version;
  if (pinned && installed.version !== pinned)
    problems.push(`${name} 版本不符：已安装 ${installed.version}，package-lock.json 要求 ${pinned}`);
}

if (problems.length > 0) {
  console.error('依赖自检未通过：node_modules 与 package.json / package-lock.json 不一致。');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('');
  console.error('请在 prototype 目录执行以下命令后重试：');
  console.error('  npm install');
  process.exit(1);
}
