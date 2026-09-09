import { randomUUID, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { createPrivateResearchStore } from './private-research-store.mjs';
import { conditionHistory } from './condition-history.mjs';
import { createUsageGate } from './usage-gate.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  analyze,
  rematchAnalysis,
  search,
  validProfile,
  validateAnalysis,
  setTempCredential,
  summaryCredentialStatus,
  zhihuBackendQuota,
} from './engine.mjs';
import { curatedArchive } from './archive-annotations.mjs';
import { fetchOfficialSources } from './official-source.mjs';
import { buildOfficialAssessment } from './official-assessment.mjs';
import { analysisProvider, requiredQuotaIds } from './deepseek.mjs';
import { createIntakePlan, createLocalIntakePlan } from './intake.mjs';
import { createResearchStore } from './research-store.mjs';
import { createTelemetry, failureCategory } from './telemetry.mjs';
import { addFeedback, listFeedback, addUsage, listUsage } from './storage.mjs';

const jobs = new Map();
let active = 0;
let intakeActive = 0;
let quota = null;
let quotaAt = 0;

export function resolveAdminPassword(env = process.env) {
  const configured = env.ADMIN_PASSWORD?.trim();
  if (configured) return configured;
  return env.NODE_ENV === 'production' ? null : 'life-branches-dev';
}

export function developerToolsAllowed(req, env = process.env) {
  if (env.NODE_ENV === 'production') return false;
  try {
    const hostname = new URL(`http://${req.headers.host}`).hostname;
    return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  } catch {
    return false;
  }
}

function authAdmin(req, env = process.env) {
  const got = req.headers['x-admin-password'];
  if (typeof got !== 'string' || !got) return false;
  const want = resolveAdminPassword(env);
  if (!want) return false;
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
    quota = (await zhihuBackendQuota()).Data;
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

export function localApi(options = {}) {
  const telemetry = createTelemetry(options.telemetryPath);
  const runtimeEnv = options.env || process.env;
  const production = runtimeEnv.NODE_ENV === 'production';
  const researchStore = production ? createPrivateResearchStore(options.researchStorePath) : createResearchStore(options.researchStorePath);
  const gate = createUsageGate({ file: options.budgetPath });
  const reserve = (req, cost) => {
    if (runtimeEnv.NODE_ENV === 'production')
      gate.reserve(req.socket?.remoteAddress || 'unknown', cost);
  };
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
          let owner = 'local-development';
          if (production) {
            let token = String(req.headers.cookie || '').match(/(?:^|;\s*)__Host-life-branches=([a-f0-9]{64})(?:;|$)/)?.[1];
            if (!token) {
              token = randomBytes(32).toString('hex');
              res.setHeader('Set-Cookie', `__Host-life-branches=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`);
            }
            owner = createHash('sha256').update(token).digest('hex');
          }
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
              developerTools: developerToolsAllowed(req, runtimeEnv),
              privateResearch: production,
            });
          }
          if (
            req.method === 'GET' &&
            url.pathname === '/api/branches/researches'
          ) {
            return send(res, 200, { records: await researchStore.list(owner) });
          }
          if (
            req.method === 'GET' &&
            url.pathname === '/api/branches/metrics'
          ) {
            return send(res, 200, await telemetry.summary());
          }
          const researchMatch = url.pathname.match(
            /^\/api\/branches\/researches\/([^/]+)$/,
          );
          if (researchMatch && req.method === 'GET') {
            const record = await researchStore.get(researchMatch[1], owner);
            if (!record)
              return send(res, 404, { error: '这条研究记录不存在。' });
            const restored = {
              ...record.job,
              id: randomUUID(),
              createdAt: Date.now(),
              restoredFrom: record.id,
            };
            jobs.set(restored.id, restored);
            return send(res, 200, restored);
          }
          if (researchMatch && req.method === 'DELETE') {
            const removed = await researchStore.remove(researchMatch[1], owner);
            return removed
              ? send(res, 200, { ok: true })
              : send(res, 404, { error: '这条研究记录不存在。' });
          }
          if (
            req.method === 'POST' &&
            url.pathname === '/api/branches/researches'
          ) {
            const input = await body(req);
            const job = jobs.get(input?.jobId);
            if (production && job?.owner !== owner) return send(res, 404, { error: '研究不存在。' });
            return send(res, 201, await researchStore.save(job, owner));
          }
          if (
            req.method === 'POST' &&
            url.pathname === '/api/branches/intake'
          ) {
            if (
              !String(req.headers['content-type']).startsWith(
                'application/json',
              )
            )
              return send(res, 415, { error: '请求格式不正确。' });
            const input = await body(req);
            if (input?.decisionPath)
              return send(
                res,
                200,
                createLocalIntakePlan(input?.question, input.decisionPath),
              );
            if (intakeActive >= 2)
              return send(res, 429, {
                error: '已有条件表单正在生成，请稍后重试。',
              });
            try { reserve(req, { searches: 0, models: 1 }); }
            catch (error) { return send(res, 429, { error: error.message }); }
            intakeActive++;
            try {
              return send(res, 200, await createIntakePlan(input?.question));
            } finally {
              intakeActive--;
            }
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
                result: validateAnalysis(
                  saved.result,
                  saved.sources,
                  saved.profile,
                ),
                id: randomUUID(),
                createdAt: Date.now(),
                historical: true,
                owner,
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
            if (!job || (production && job.owner !== owner) || Date.now() - job.createdAt > 3600000)
              return send(res, 404, { error: '这次探索已过期，请重新搜索。' });
            return send(res, 200, job);
          }
          if (
            req.method === 'GET' &&
            url.pathname === '/api/branches/settings'
          ) {
            if (!developerToolsAllowed(req, runtimeEnv))
              return send(res, 404, { error: '未找到请求。' });
            return send(res, 200, {
              provider: analysisProvider(),
              devOverride: summaryCredentialStatus(), // 脱敏；不返回完整 key
            });
          }
          if (req.method === 'POST' && url.pathname === '/api/branches/keys') {
            if (!developerToolsAllowed(req, runtimeEnv))
              return send(res, 404, { error: '未找到请求。' });
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
            req.method === 'DELETE' &&
            url.pathname === '/api/branches/feedback'
          ) {
            if (!production) return send(res, 409, { error: '开发环境共享反馈无法按会话删除。' });
            return send(res, 200, { removed: await researchStore.removeFeedback(owner) });
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
              reserve(req, { searches: 0, models: 0 });
              const feedbackRecord = {
                id: randomUUID(),
                rating,
                comment,
                question,
                jobId,
              };
              if (production) await researchStore.addFeedback(feedbackRecord, owner);
              else await addFeedback(feedbackRecord);
              return send(res, 200, { ok: true });
            } catch (e) {
              return send(res, 400, { error: e.message || '反馈提交失败。' });
            }
          }
          if (
            req.method === 'GET' &&
            url.pathname === '/api/branches/admin/summary'
          ) {
            if (!resolveAdminPassword(runtimeEnv))
              return send(res, 503, {
                error:
                  '管理功能未启用：生产环境必须配置 ADMIN_PASSWORD。',
              });
            if (!authAdmin(req, runtimeEnv))
              return send(res, 401, { error: '管理密码错误或未登录。' });
            await ensureQuota();
            const feedback = production ? await researchStore.listAllFeedback() : await listFeedback();
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
                !runtimeEnv.ADMIN_PASSWORD &&
                resolveAdminPassword(runtimeEnv) === 'life-branches-dev',
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
            (!previous ||
              (production && previous.owner !== owner) ||
              Date.now() - previous.createdAt > 3600000 ||
              previous.profile.question !== profile.question)
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
          try { reserve(req, { searches: previous ? 0 : 5, models: previous ? 0 : 2 }); }
          catch (error) { return send(res, 429, { error: error.message }); }
          const job = {
            id: randomUUID(),
            status: 'running',
            owner,
            progress: '正在准备检索…',
            createdAt: Date.now(),
            profile,
            sources: previous?.sources || [],
            conditionHistory: conditionHistory(previous, profile),
            officialSources: previous?.officialSources || [],
            officialAssessment: previous?.officialAssessment || null,
            result: null,
            error: null,
            reused: Boolean(previous),
            historical: previous?.historical || false,
            metrics: { searchCalls: 0, cacheHits: 0, stages: [] },
          };
          jobs.set(job.id, job);
          active++;
          send(res, 202, { id: job.id });
          void (async () => {
            const requestStarted = Date.now();
            const recordMetric = (metric) => {
              job.metrics.searchCalls += metric.searchCalls || 0;
              job.metrics.cacheHits += metric.cacheHits || 0;
              job.metrics.stages.push(metric);
              void telemetry.record({
                requestId: job.id,
                event: 'stage',
                ...metric,
              });
            };
            try {
              if (!previous) {
                job.progress = '正在读取你提供的官方通知…';
                const officialStarted = Date.now();
                job.officialSources = await fetchOfficialSources(profile);
                recordMetric({
                  stage: 'official_source',
                  status: 'ok',
                  elapsedMs: Date.now() - officialStarted,
                  sourceCount: job.officialSources.length,
                });
                job.officialAssessment = buildOfficialAssessment(
                  job.officialSources,
                  profile,
                );
                job.sources = await search(
                  profile,
                  (message) => {
                    job.progress = message;
                  },
                  (sources) => {
                    job.sources = sources;
                  },
                  recordMetric,
                );
              }
              if (previous)
                job.officialAssessment = buildOfficialAssessment(
                  job.officialSources,
                  profile,
                );
              const analysisStarted = Date.now();
              job.result = previous
                ? rematchAnalysis(previous.result, job.sources, profile)
                : await analyze(job.sources, profile, (message) => {
                    job.progress = message;
                  });
              recordMetric({
                stage: 'analysis',
                status: 'ok',
                elapsedMs: Date.now() - analysisStarted,
                provider: job.result.analysis?.provider || analysisProvider(),
                model: job.result.analysis?.model || 'none',
                ruleVersion: job.result.ruleVersion || 'unknown',
                acceptedCases: job.result.paths.reduce(
                  (sum, path) => sum + path.cases.length,
                  0,
                ),
                rejected: job.result.rejected,
                rejectionReasons: job.result.rejectionReasons,
                citationPassRate: job.result.citationPassRate,
              });
              job.status = 'done';
              job.progress = '探索完成';
              void telemetry.record({
                requestId: job.id,
                event: 'completed',
                status: 'ok',
                elapsedMs: Date.now() - requestStarted,
                searchCalls: job.metrics.searchCalls,
                cacheHits: job.metrics.cacheHits,
                sourceCount: job.sources.length,
                provider: job.result.analysis?.provider || analysisProvider(),
                model: job.result.analysis?.model || 'none',
                ruleVersion: job.result.ruleVersion || 'unknown',
                acceptedCases: job.result.paths.reduce(
                  (sum, path) => sum + path.cases.length,
                  0,
                ),
                rejected: job.result.rejected,
                rejectionReasons: job.result.rejectionReasons,
                citationPassRate: job.result.citationPassRate,
              });
            } catch (error) {
              job.status = 'error';
              job.error = error.message || '探索暂时未能完成。';
              void telemetry.record({
                requestId: job.id,
                event: 'failed',
                status: failureCategory(error),
                elapsedMs: Date.now() - requestStarted,
                searchCalls: job.metrics.searchCalls,
                cacheHits: job.metrics.cacheHits,
              });
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
