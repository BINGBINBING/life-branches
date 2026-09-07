import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { dictionaryIndex } from './condition-dictionary.mjs';

const STORE_VERSION = 1;
const MAX_RECORDS = 60;
const MAX_BYTES = 8 * 1024 * 1024;

export function defaultResearchStorePath(cwd = process.cwd()) {
  return join(cwd, '.local', 'researches.json');
}

function validDatabase(value) {
  return value &&
    value.version === STORE_VERSION &&
    Array.isArray(value.records)
    ? value
    : { version: STORE_VERSION, records: [] };
}

function summary(record) {
  const paths = record.job?.result?.paths || [];
  const profile = record.job?.profile || {};
  return {
    id: record.id,
    savedAt: record.savedAt,
    question: record.job?.profile?.question || '未命名选择',
    scope: record.job?.profile?.decisionScope || '',
    pathCount: paths.length,
    caseCount: paths.reduce((sum, path) => sum + (path.cases?.length || 0), 0),
    conditionCount: Object.keys(profile.conditionAnswers || {}).length,
    conditions: [
      profile.background && { id: 'background', label: '背景', value: profile.background },
      profile.time && { id: 'time', label: '投入', value: profile.time },
      profile.goal && { id: 'goal', label: '目标与限制', value: profile.goal },
      ...Object.entries(profile.conditionAnswers || {}).map(([id, value]) => ({
        id,
        label: dictionaryIndex.get(id)?.label || id,
        value,
      })),
    ].filter(Boolean),
  };
}

export function createResearchStore(file = defaultResearchStorePath()) {
  let queue = Promise.resolve();

  async function read() {
    try {
      return validDatabase(JSON.parse(await readFile(file, 'utf8')));
    } catch (error) {
      if (error?.code === 'ENOENT') return validDatabase(null);
      throw new Error('本地研究记录无法读取。');
    }
  }

  async function write(database) {
    const content = JSON.stringify(database);
    if (Buffer.byteLength(content) > MAX_BYTES)
      throw new Error('本地研究记录空间已满，请删除旧记录。');
    await mkdir(dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await writeFile(temporary, content, { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, file);
  }

  function mutate(operation) {
    const next = queue.then(operation);
    queue = next.catch(() => {});
    return next;
  }

  return {
    async list() {
      const database = await read();
      return database.records.map(summary);
    },
    async get(id) {
      const database = await read();
      return database.records.find((record) => record.id === id) || null;
    },
    save(job) {
      return mutate(async () => {
        if (!job || job.status !== 'done' || !job.result)
          throw new Error('探索完成后才能保存。');
        const database = await read();
        const record = {
          id: randomUUID(),
          savedAt: Date.now(),
          job: JSON.parse(JSON.stringify(job)),
        };
        database.records.unshift(record);
        database.records = database.records.slice(0, MAX_RECORDS);
        await write(database);
        return summary(record);
      });
    },
    remove(id) {
      return mutate(async () => {
        const database = await read();
        const before = database.records.length;
        database.records = database.records.filter((record) => record.id !== id);
        if (database.records.length === before) return false;
        if (!database.records.length) {
          try {
            await unlink(file);
          } catch (error) {
            if (error?.code !== 'ENOENT') throw error;
          }
        } else {
          await write(database);
        }
        return true;
      });
    },
  };
}
