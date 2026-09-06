import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCliBinary } from './engine.mjs';

const base = {
  env: {},
  home: 'C:\\Users\\Tester',
  os: 'win32',
  exists: () => false,
};
test('Windows uses official LOCALAPPDATA install location', () => {
  assert.equal(
    resolveCliBinary({ ...base, env: { LOCALAPPDATA: 'D:\\Apps' } }),
    'D:\\Apps\\ZhihuCLI\\current\\zhihu-cli.exe',
  );
});
test('Windows falls back to user AppData', () => {
  assert.equal(
    resolveCliBinary(base),
    'C:\\Users\\Tester\\AppData\\Local\\ZhihuCLI\\current\\zhihu-cli.exe',
  );
});
test('explicit binary takes precedence over install home', () => {
  assert.equal(
    resolveCliBinary({
      ...base,
      env: { ZHIHU_CLI_PATH: 'custom.exe', ZHIHU_CLI_HOME: 'D:\\CLI' },
    }),
    'custom.exe',
  );
});
test('custom install home respects platform executable suffix', () => {
  assert.equal(
    resolveCliBinary({ ...base, env: { ZHIHU_CLI_HOME: 'D:\\CLI' } }),
    'D:\\CLI\\current\\zhihu-cli.exe',
  );
});
test('macOS preserves original install location', () => {
  assert.equal(
    resolveCliBinary({ ...base, os: 'darwin', home: '/Users/test' }),
    '/Users/test/Library/Application Support/zhihu-cli/current/zhihu-cli',
  );
});
