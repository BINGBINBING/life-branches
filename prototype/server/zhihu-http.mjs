// 知乎开放平台 HTTP 直连 provider（云端 / 无 zhihu-cli 场景）
//
// 职责：用环境变量里的 Access Secret 直接调官方 HTTP API，返回与
// zhihu-cli 输出同构的 { Code, Message, Data } / chat.completion JSON。
// 不依赖本机安装的 zhihu-cli、keychain 或文件系统——因此可运行在
// Cloudflare Workers 等无本地可执行文件环境。
//
// 凭证从 process.env.ZHIHU_ACCESS_SECRET 读取（Worker secrets / 本机 .env），
// 绝不出现在前端、日志或仓库。
import { requiredQuotaIds } from './deepseek.mjs';

const API_BASE = 'https://developer.zhihu.com';

function resolveSecret(opts) {
  const s = opts?.secret || process.env.ZHIHU_ACCESS_SECRET;
  if (!s) throw new Error('未配置 ZHIHU_ACCESS_SECRET（知乎开放平台 Access Secret）。');
  return s;
}

async function request(path, opts = {}) {
  const m = resolveSecret(opts);
  const ts = Math.floor(Date.now() / 1000);
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    redirect: 'error',
    headers: {
      Authorization: `Bearer ${m}`,
      'X-Request-Timestamp': String(ts),
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(opts.timeoutMs || 60000),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || (json && json.Code != null && json.Code !== 0)) {
    const server = json?.Code;
    if (server === 30001 || server === 30002 || response.status === 429)
      throw new Error('ZHIHU_RATE');
    if (server === 20001 || response.status === 401)
      throw new Error('ZHIHU_AUTH');
    if (!response.ok) throw new Error(`ZHIHU_HTTP_${response.status}`);
    throw new Error('ZHIHU_UPSTREAM');
  }
  return json;
}

/** 搜索知乎：返回与 cli() 一致的 { Code, Data:{Items:[...]} }。 */
export async function searchZhihu(query, count = 5, opts = {}) {
  const params = new URLSearchParams();
  params.set('Query', query);
  params.set('Count', String(count));
  const res = await request(
    `/api/v1/content/zhihu_search?${params.toString()}`,
    opts,
  );
  if (!res || !res.Data || !Array.isArray(res.Data.Items)) {
    return { Code: 0, Message: 'success', Data: { Items: [] } };
  }
  return res;
}

/** 额度查询：返回 { Code, Data: [{APIID,...}] } */
export async function queryQuota(opts = {}) {
  const list = requiredQuotaIds(false);
  const params = new URLSearchParams();
  params.set('APIIDs', list.join(','));
  const res = await request(`/api/v1/quota?${params.toString()}`, opts);
  const items = Array.isArray(res.Data) ? res.Data : [];
  return { Code: 0, Message: 'success', Data: items };
}

/** 知乎直答（zhida）——chat.completions 结构。 */
export async function chatCompletions({
  model,
  messages,
  timeoutMs = 90000,
  secret,
} = {}) {
  const m = resolveSecret({ secret });
  const response = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: 'POST',
    redirect: 'error',
    headers: {
      Authorization: `Bearer ${m}`,
      'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, stream: false }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || (json && json.Code != null && json.Code !== 0)) {
    if (response.status === 401 || json?.Code === 20001)
      throw new Error('ZHIHU_AUTH');
    if (response.status === 429 || json?.Code === 30001 || json?.Code === 30002)
      throw new Error('ZHIHU_RATE');
    if (!response.ok) throw new Error(`ZHIHU_HTTP_${response.status}`);
    throw new Error('ZHIHU_UPSTREAM');
  }
  return json;
}

// 该 provider 是否可用（本地或云端都靠环境变量里的 Secret）。
export function hasZhihuSecret() {
  return Boolean(process.env.ZHIHU_ACCESS_SECRET);
}
