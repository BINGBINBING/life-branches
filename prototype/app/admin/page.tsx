'use client';

import { useEffect, useState } from 'react';
import { Check, Lock, RefreshCw, X } from 'lucide-react';

type Summary = {
  today: string;
  adminPasswordRequired: boolean;
  zhihuQuota: { APIID: string; APIName: string; RemainingQuota: number; TotalQuota: number }[] | null;
  usage: {
    total: number;
    ok: number;
    failed: number;
    okToday: number;
    avgSources: number;
    tokens: { prompt: number; completion: number; total: number };
    byModel: Record<string, number>;
    lastRecords: {
      ok: boolean; reused: boolean; sources: number; provider: string | null;
      model: string | null; usage: Record<string, number> | null;
      error: string | null; question: string; at: number;
    }[];
  };
  feedback: {
    total: number;
    avgRating: number | null;
    ratingCounts: { rating: number; count: number }[];
    recent: { id: string; rating: number; comment: string; question: string; at: number }[];
  };
};

const STORE_KEY = 'lb-admin-pw';

async function fetchSummary(pw: string): Promise<Summary> {
  const response = await fetch('/api/branches/admin/summary', {
    headers: { 'x-admin-password': pw },
  });
  const data = (await response.json()) as Summary & { error?: string };
  if (!response.ok) throw new Error(data.error || '无法访问数据后台。');
  return data;
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
}

function Card({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <h2>{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="admin-metric">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

export default function AdminPage() {
  const [pw, setPw] = useState('');
  const [authed, setAuthed] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const loading = authed && !data;

  // 客户端挂载后自动恢复会话（sessionStorage 不可用于服务端渲染）。
  useEffect(() => {
    let ignore = false;
    const stored = sessionStorage.getItem(STORE_KEY) ?? '';
    if (!stored) {
      void Promise.resolve().then(() => {
        if (!ignore) setRestoring(false);
      });
      return () => {
        ignore = true;
      };
    }
    fetchSummary(stored)
      .then((d) => {
        if (ignore) return;
        setData(d);
        setAuthed(true);
        if (d.adminPasswordRequired)
          setError('提示：未设置 ADMIN_PASSWORD，正在使用本地开发默认密码。');
      })
      .catch((e) => {
        if (ignore) return;
        setError(e instanceof Error ? e.message : '加载失败。');
        sessionStorage.removeItem(STORE_KEY);
      })
      .finally(() => {
        if (!ignore) setRestoring(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function login() {
    if (!pw) return;
    setLoggingIn(true);
    setError('');
    try {
      const d = await fetchSummary(pw);
      sessionStorage.setItem(STORE_KEY, pw);
      setData(d);
      setAuthed(true);
      if (d.adminPasswordRequired)
        setError('提示：未设置 ADMIN_PASSWORD，正在使用本地开发默认密码。');
    } catch (e) {
      setError(e instanceof Error ? e.message : '密码错误。');
    } finally {
      setLoggingIn(false);
    }
  }

  function logout() {
    sessionStorage.removeItem(STORE_KEY);
    setAuthed(false);
    setData(null);
    setPw('');
  }

  if (restoring) {
    return (
      <main className="admin-page">
        <div className="admin-login">
          <RefreshCw className="spin" size={26} />
          <p className="muted">正在恢复会话…</p>
        </div>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="admin-page">
        <div className="admin-login">
          <div className="brand">
            <Lock size={18} />
            <strong>数据后台</strong>
          </div>
          <p className="muted">查看用户反馈、token 与知乎额度、使用次数</p>
          <input
            type="password"
            autoComplete="current-password"
            value={pw}
            placeholder="管理密码"
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void login();
            }}
          />
          <button className="primary" disabled={!pw || loggingIn} onClick={() => void login()}>
            {loggingIn ? '验证中…' : '进入后台'}
          </button>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="admin-page">
        <div className="admin-login">
          <RefreshCw className="spin" size={26} />
          <p className="muted">{loading ? '加载统计数据…' : '请先登录数据后台。'}</p>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </main>
    );
  }

  const rate = data.usage.total
    ? Math.round((data.usage.ok / data.usage.total) * 100)
    : 100;

  return (
    <main className="admin-page">
      <div className="admin-topbar">
        <div className="brand">
          <strong>人生分枝 · 数据后台</strong>
          <span className="meta">更新于 {new Date().toLocaleString('zh-CN', { hour12: false })}</span>
        </div>
        <button className="ghost" onClick={() => window.location.reload()}>
          <RefreshCw size={15} /> 刷新
        </button>
        <button className="ghost" onClick={logout}>
          <X size={15} /> 退出
        </button>
      </div>

      <Card title="概览" right={<span className="meta">今日 {data.today}</span>}>
        <div className="admin-metrics">
          <Metric label="总探索次数" value={data.usage.total} />
          <Metric label="成功 / 失败" value={`${data.usage.ok} / ${data.usage.failed}`} />
          <Metric label="今日成功" value={data.usage.okToday} />
          <Metric label="成功率" value={`${rate}%`} />
          <Metric label="平均来源数" value={data.usage.avgSources} />
          <Metric label="反馈总数" value={data.feedback.total} />
        </div>
      </Card>

      <div className="admin-cols">
        <Card title="Token 用量">
          <div className="admin-metrics">
            <Metric label="总 tokens" value={data.usage.tokens.total.toLocaleString()} />
            <Metric label="prompt" value={data.usage.tokens.prompt.toLocaleString()} />
            <Metric label="completion" value={data.usage.tokens.completion.toLocaleString()} />
          </div>
          {Object.keys(data.usage.byModel).length > 0 && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>模型</th>
                  <th>次数</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.usage.byModel).map(([m, c]) => (
                  <tr key={m}>
                    <td>{m}</td>
                    <td>{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="知乎额度（实时）">
          {data.zhihuQuota?.length ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>能力</th>
                  <th>已用/总额</th>
                  <th>剩余</th>
                </tr>
              </thead>
              <tbody>
                {data.zhihuQuota.map((q) => (
                  <tr key={q.APIID}>
                    <td>{q.APIName}</td>
                    <td>
                      {q.TotalQuota - q.RemainingQuota}/{q.TotalQuota}
                    </td>
                    <td>{q.RemainingQuota}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">额度查询暂不可用（CLI 未配置或调用失败）。</p>
          )}
        </Card>
      </div>

      <Card title={`用户反馈（共 ${data.feedback.total} 条）`}>
        <div className="admin-metrics">
          <Metric
            label="平均评分"
            value={data.feedback.avgRating != null ? `${data.feedback.avgRating} / 5` : '—'}
          />
          {data.feedback.ratingCounts.map((r) => (
            <Metric key={r.rating} label={`${r.rating} 星`} value={r.count} />
          ))}
        </div>
        {data.feedback.recent.length ? (
          <ul className="admin-feedback-list">
            {data.feedback.recent.map((f) => (
              <li key={f.id}>
                <div>
                  <b>{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</b>{' '}
                  <span className="meta">{fmtTime(f.at)}</span>
                  {f.question && (
                    <div className="meta">
                      探索：{f.question}
                    </div>
                  )}
                  {f.comment && <p>{f.comment}</p>}
                  {!f.comment && <p className="meta">（无文字评论）</p>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">还没有用户反馈。</p>
        )}
      </Card>

      <Card title="最近使用记录">
        {data.usage.lastRecords.length ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>状态</th>
                <th>来源</th>
                <th>Provider</th>
                <th>模型</th>
                <th>tokens</th>
                <th>探索内容</th>
              </tr>
            </thead>
            <tbody>
              {data.usage.lastRecords.map((u, i) => (
                <tr key={i}>
                  <td>{fmtTime(u.at)}</td>
                  <td>
                    {u.ok ? <Check size={14} /> : <X size={14} />}
                    {u.ok ? '成功' : '失败'}
                  </td>
                  <td>{u.sources}</td>
                  <td>{u.provider ?? '—'}</td>
                  <td>{u.model ?? '—'}</td>
                  <td>{(u.usage?.total_tokens ?? 0).toLocaleString()}</td>
                  <td className="admin-cell-ellipsis" title={u.error ?? u.question}>
                    {u.error || u.question || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">还没有探索记录。</p>
        )}
      </Card>
    </main>
  );
}
