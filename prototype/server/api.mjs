import { randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  analyze,
  search,
  validProfile,
  cli,
  setTempCredential,
  summaryCredentialStatus,
} from './engine.mjs';
import { curatedArchive } from './archive-annotations.mjs';
import { analysisProvider, requiredQuotaIds } from './deepseek.mjs';
import { addFeedback, listFeedback, addUsage, listUsage } from './storage.mjs';

const jobs = new Map();
let active = 0;
let quota = null;
let quotaAt = 0;

// 管理后台密码：优先取环境变量；未配置时使用仅供本地开发的默认值（上云前必须设置 ADMIN_PASSWORD）。
function adminPassword() {
  return process.env.ADMIN_PASSWORD || 'life-branches-dev';
}

function authAdmin(req) {
  const got = req.headers['x-admin-password'];
  if (typeof got !== 'string' || !got) return false;
  const want = adminPassword();
  if (got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

function localDay(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function ensureQuota() {
  if (Date.now() - quotaAt <= 60000) return;
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
            await ensureQuota();
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
              provider: analysisProvider(),
              quota:
                quota?.filter((q) =>
                  requiredQuotaIds(false).includes(q.APIID),
                ) ?? null,
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
          if (req.method === 'GET' && url.pathname === '/api/branches/settings') {
            return send(res, 200, {
              provider: analysisProvider(),
              devOverride: summaryCredentialStatus(), // 脱敏；不返回完整 key
            });
          }
          if (
            req.method === 'POST' &&
            url.pathname === '/api/branches/keys'
          ) {
            try {
              const input = await body(req);
              // 仅开发期：type 取 zhihu|ai；value 为空则清除该项。
              const kind = input?.type;
              if (kind !== 'zhihu' && kind !== 'ai')
                return send(res, 400, { error: 'kind 只能为 zhihu 或 ai。' });
              const value =
                typeof input?.value === 'string' && input.value.trim()
                  ? input.value.trim()
                  : null;
              if (value && value.length > 4096)
                return send(res, 400, { error: '密钥过长。' });
              const masked = setTempCredential(kind, value); // 不落盘/不打日志
              return send(res, 200, { ok: true, devOverride: masked });
            } catch (e) {
              return send(res, 400, { error: e.message || '设置失败。' });
            }
          }
          if (
            req.method === 'POST' &&
            url.pathname === '/api/branches/feedback'
          ) {
            try {
              const input = await body(req);
              const rating = Number(input?.rating);
              const comment = String(input?.comment ?? '').trim();
              if (!Number.isInteger(rating) || rating < 1 || rating > 5)
                return send(res, 400, { error: '评分需为 1–5 的整数。' });
              if (comment.length > 2000)
                return send(res, 400, { error: '评论过长（限 2000 字）。' });
              const question = String(input?.question ?? '')
                .trim()
                .slice(0, 120);
              const jobId =
                typeof input?.jobId === 'string' && input.jobId
                  ? input.jobId.slice(0, 64)
                  : null;
              await addFeedback({
                id: randomUUID(),
                rating,
                comment,
                question,
                jobId,
              });
              return send(res, 200, { ok: true });
            } catch (e) {
              return send(res, 400, { error: e.message || '反馈提交失败。' });
            }
          }
          if (
            req.method === 'GET' &&
            url.pathname === '/api/branches/admin/summary'
          ) {
            if (!authAdmin(req))
              return send(res, 401, { error: '管理密码错误或未登录。' });
            await ensureQuota();
            const feedback = await listFeedback();
            const usage = await listUsage();
            const today = localDay(Date.now());
            const ok = usage.filter((u) => u.ok);
            const failed = usage.filter((u) => !u.ok);
            const okToday = ok.filter((u) => localDay(u.at) === today);
            const tokens = ok.reduce(
              (acc, u) => {
                const g = u.usage || {};
                acc.prompt += Number(g.prompt_tokens) || 0;
                acc.completion += Number(g.completion_tokens) || 0;
                acc.total += Number(g.total_tokens) || 0;
                return acc;
              },
              { prompt: 0, completion: 0, total: 0 },
            );
            const byModel = {};
            for (const u of ok)
              if (u.model) byModel[u.model] = (byModel[u.model] || 0) + 1;
            const avgSources = ok.length
              ? ok.reduce((s, u) => s + (u.sources || 0), 0) / ok.length
              : 0;
            const ratingSum = feedback.reduce(
              (s, f) => s + (Number(f.rating) || 0),
              0,
            );
            return send(res, 200, {
              admin: true,
              serverTime: new Date().toISOString(),
              today,
              adminPasswordRequired:
                !process.env.ADMIN_PASSWORD &&
                adminPassword() === 'life-branches-dev',
              zhihuQuota: quota ?? null,
              usage: {
                total: usage.length,
                ok: ok.length,
                failed: failed.length,
                okToday: okToday.length,
                avgSources: Number(avgSources.toFixed(1)),
                tokens,
                byModel,
                lastRecords: [...usage].reverse().slice(0, 30),
              },
              feedback: {
                total: feedback.length,
                avgRating: feedback.length
                  ? Number((ratingSum / feedback.length).toFixed(2))
                  : null,
                ratingCounts: [5, 4, 3, 2, 1].map((r) => ({
                  rating: r,
                  count: feedback.filter((f) => f.rating === r).length,
                })),
                recent: [...feedback].reverse().slice(0, 50),
              },
            });
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
            const needed = requiredQuotaIds(Boolean(input.previousId));
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
              const meta = job.result?.analysis || {};
              try {
                await addUsage({
                  ok: job.status === 'done',
                  reused: job.reused,
                  sources: job.sources.length,
                  provider: meta.provider || null,
                  model: meta.model || null,
                  usage: meta.usage || null,
                  error:
                    job.status === 'error'
                      ? String(job.error || '').slice(0, 200)
                      : null,
                  question: String(job.profile?.question || '').slice(0, 120),
                });
              } catch {
                // 用量记录失败不影响探索结果本身。
              }
            }
          })();
        } catch (error) {
          send(res, 400, { error: error.message || '请求未能完成。' });
        }
      });
    },
  };
}
