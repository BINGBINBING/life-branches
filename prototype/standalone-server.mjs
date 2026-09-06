// 方案乙：单端口生产服务（Node，无 Cloudflare/无 vite dev）
//
// 在纯 Node 服务器上同时提供：
//   - 页面：dist/（vinext 生产产物里的 worker 形态 handler + ASSETS 静态）
//   - API：server/api.mjs 的 localApi() 中间件（与本地开发同一份代码）
//
// 用途：让“本地这套后端 + 前端产物”能在任意有 Node 24 的 VPS 上原样运行，
// 不需要 Cloudflare Worker 环境，也无需改 engine/storage/http 任何逻辑。
//
// 运行（cwd = prototype）：先 `npm run build`，再：
//   node standalone-server.mjs            （默认 127.0.0.1:4320）
//   PORT=4321 node standalone-server.mjs  （自定义端口）
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localApi } from './server/api.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(ROOT, 'dist', 'client');
const PORT = Number(process.env.PORT || 4320);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

async function readFileSafe(rel) {
  // 防目录穿越：规范化后必须仍在 CLIENT_DIR 内
  const fp = path.normalize(path.join(CLIENT_DIR, rel));
  if (fp !== CLIENT_DIR && !fp.startsWith(CLIENT_DIR + path.sep)) return null;
  try {
    const info = await stat(fp);
    if (!info.isFile()) return null;
    return await readFile(fp);
  } catch {
    return null;
  }
}

function contentType(file) {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

// ---------- 1) API：复用 localApi 中间件 ----------
const apiMiddlewares = [];
localApi().configureServer({
  middlewares: {
    use: (mw) => apiMiddlewares.push(mw),
  },
});

function runApi(req, res) {
  return new Promise((resolve) => {
    let i = 0;
    let ended = false;
    const next = () => {
      if (ended) return;
      const mw = apiMiddlewares[i++];
      if (!mw) return resolve(false); // 没有中间件处理 → 非 /api 路径
      let called = false;
      try {
        mw(req, res, () => {
          if (!called) {
            called = true;
            next();
          }
        });
        // 同步结束（res.end 已被调用）→ 视为已处理
        if (res.writableEnded) {
          ended = true;
          resolve(true);
        }
      } catch (e) {
        ended = true;
        if (!res.headersSent)
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: String(e?.message || e) }));
        resolve(true);
      }
    };
    res.on('finish', () => {
      ended = true;
      resolve(true);
    });
    next();
  });
}

// ---------- 2) 页面：托管 dist/client 产物（SSR 由 vinext worker handler 渲染） ----------
let pageHandler = null;
async function loadPageHandler() {
  if (pageHandler) return pageHandler;
  const mod = await import('./dist/server/index.js');
  const exported = mod.default || mod;
  // worker 形态入口可能是 { fetch } 对象，也可能是函数
  pageHandler = typeof exported === 'function' ? exported : exported?.fetch;
  if (typeof pageHandler !== 'function')
    throw new Error('dist 页面产物未导出 fetch handler（请先 npm run build）。');
  return pageHandler;
}

// ASSETS 绑定：让 worker 形态 handler 的静态资源请求落到本地 dist/client
const assetsEnv = {
  ASSETS: {
    async fetch(request) {
      const url = new URL(request.url);
      let rel = decodeURIComponent(url.pathname);
      if (rel.endsWith('/')) rel = 'index.html';
      const buf = await readFileSafe(rel.startsWith('/') ? rel.slice(1) : rel);
      if (!buf) return new Response('Not Found', { status: 404 });
      return new Response(new Uint8Array(buf), {
        status: 200,
        headers: { 'Content-Type': contentType(rel) },
      });
    },
  },
};

async function servePage(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  // 1) 静态资源（/_next、/favicon 等）直接从 dist/client 返回
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (rel) {
    const buf = await readFileSafe(rel);
    if (buf) {
      res.writeHead(200, {
        'Content-Type': contentType(rel),
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      res.end(buf);
      return;
    }
  }
  // 2) 页面路由交给 vinext 产物的 SSR handler
  const handler = await loadPageHandler();
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null) continue;
    headers.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  let body;
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    body = Buffer.concat(chunks);
  }
  const request = new Request(url.href, {
    method: req.method,
    headers,
    ...(body ? { body: new Uint8Array(body), duplex: 'half' } : {}),
  });
  const response = await handler(request, assetsEnv);
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  if (response.body) {
    for await (const chunk of response.body) res.write(chunk);
  }
  res.end();
}

// ---------- 3) 入口 ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const handled = await runApi(req, res);
      if (!handled) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'not found' }));
      }
      return;
    }
    await servePage(req, res);
  } catch (e) {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end(`Server error: ${String(e?.message || e)}`);
  }
});

server.listen(PORT, '127.0.0.1', async () => {
  try {
    await loadPageHandler();
  } catch (e) {
    console.error('加载 dist 页面产物失败（先执行 npm run build）:', e?.message || e);
  }
  console.log(`人生分枝 standalone 服务已启动: http://127.0.0.1:${PORT}`);
});
