import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { analyze, search, validProfile, cli } from './engine.mjs';
import { curatedArchive } from './archive-annotations.mjs';

const jobs = new Map();
let active = 0;
let quota = null;
let quotaAt = 0;
const send = (res, status, data) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
};

async function body(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 16000) throw new Error('输入内容过长。');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('请求格式不正确。');
  }
}

export function localApi() {
  return {
    name: 'life-branches-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (!url.pathname.startsWith('/api/branches/')) return next();
        try {
          const origin = req.headers.origin;
          if (origin && new URL(origin).host !== req.headers.host)
            return send(res, 403, { error: '不支持跨站请求。' });
          if (req.method === 'GET' && url.pathname === '/api/branches/health') {
            if (Date.now() - quotaAt > 60000) {
              try {
                quota = (
                  await cli([
                    'quota',
                    '--api-id',
                    'zhihu_search',
                    '--api-id',
                    'zhida_openai',
                  ])
                ).Data;
                quotaAt = Date.now();
              } catch {
                quota = null;
              }
            }
            let archive = true;
            try {
              await readFile(
                join(process.cwd(), '.local/archive.json'),
                'utf8',
              );
              archive = true;
            } catch {}
            return send(res, 200, {
              ok: true,
              mode: 'local',
              provider: 'zhihu',
              quota,
              archive,
            });
          }
          if (
            req.method === 'POST' &&
            url.pathname === '/api/branches/archive'
          ) {
            try {
              let saved;
              try {
                saved = JSON.parse(
                  await readFile(
                    join(process.cwd(), '.local/archive.json'),
                    'utf8',
                  ),
                );
              } catch {
                saved = curatedArchive();
              }
              const job = {
                ...saved,
                id: randomUUID(),
                createdAt: Date.now(),
                historical: true,
              };
              for (const [id, old] of jobs)
                if (Date.now() - old.createdAt > 3600000) jobs.delete(id);
              if (jobs.size >= 30)
                return send(res, 429, {
                  error: '当前探索记录已满，请稍后重试。',
                });
              jobs.set(job.id, job);
              return send(res, 200, job);
            } catch {
              return send(res, 404, { error: '历史样本暂不可用。' });
            }
          }
          if (
            req.method === 'GET' &&
            url.pathname.startsWith('/api/branches/jobs/')
          ) {
            const job = jobs.get(url.pathname.split('/').pop());
            if (!job || Date.now() - job.createdAt > 3600000)
              return send(res, 404, { error: '这次探索已过期，请重新搜索。' });
            return send(res, 200, job);
          }
          if (req.method !== 'POST' || url.pathname !== '/api/branches/explore')
            return send(res, 404, { error: '未找到请求。' });
          if (
            !String(req.headers['content-type']).startsWith('application/json')
          )
            return send(res, 415, { error: '请求格式不正确。' });
          const input = await body(req);
          const profile = validProfile(input.profile);
          if (active >= 2)
            return send(res, 429, {
              error: '已有探索正在进行，请等待完成后再试。',
            });
          const previous = input.previousId ? jobs.get(input.previousId) : null;
          if (
            input.previousId &&
            (!previous || previous.profile.question !== profile.question)
          )
            return send(res, 400, { error: '旧探索已不可用，请重新搜索。' });
          for (const [id, job] of jobs)
            if (Date.now() - job.createdAt > 3600000) jobs.delete(id);
          if (jobs.size >= 30)
            return send(res, 429, { error: '当前探索记录已满，请稍后重试。' });
          if (quota && Date.now() - quotaAt < 60000) {
            const needed = input.previousId
              ? ['zhida_openai']
              : ['zhihu_search', 'zhida_openai'];
            if (
              quota.some(
                (q) => needed.includes(q.APIID) && q.RemainingQuota <= 0,
              )
            )
              return send(res, 429, {
                error:
                  '今日所需的知乎额度已用尽。可查看历史样本，额度恢复后再开始实时探索。',
              });
          }
          const job = {
            id: randomUUID(),
            status: 'running',
            progress: '正在准备检索…',
            createdAt: Date.now(),
            profile,
            sources: previous?.sources || [],
            result: null,
            error: null,
            reused: Boolean(previous),
            historical: previous?.historical || false,
          };
          jobs.set(job.id, job);
          active++;
          send(res, 202, { id: job.id });
          void (async () => {
            try {
              if (!previous)
                job.sources = await search(
                  profile,
                  (message) => {
                    job.progress = message;
                  },
                  (sources) => {
                    job.sources = sources;
                  },
                );
              job.result = await analyze(job.sources, profile, (message) => {
                job.progress = message;
              });
              job.status = 'done';
              job.progress = '探索完成';
            } catch (error) {
              job.status = 'error';
              job.error = error.message || '探索暂时未能完成。';
            } finally {
              active--;
              quotaAt = 0;
            }
          })();
        } catch (error) {
          send(res, 400, { error: error.message || '请求未能完成。' });
        }
      });
    },
  };
}
