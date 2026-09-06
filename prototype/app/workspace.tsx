'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  GitBranch,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sprout,
  TriangleAlert,
  X,
} from 'lucide-react';
import type {
  Experience,
  Fact,
  Job,
  Profile,
  Question,
  Source,
} from '../lib/branch-types';

const emptyProfile: Profile = {
  question: '',
  background: '',
  time: '',
  goal: '',
  answers: {},
  skipped: [],
};
const exampleChoices = [
  '非科班，在职，想转行做开发',
  '工作三年后，想考全日制研究生',
  '本科毕业后，想出国读硕士',
  '想从工科转到设计专业',
];
const resultLabels = {
  success: '阶段目标达成',
  setback: '阶段受挫',
  mixed: '有得有失',
  unknown: '结果未明',
};
const kindLabels = {
  self: '个人自述 · 未独立核实',
  retold: '转述经历',
  advice: '建议类内容',
  promotion: '机构 / 推广内容',
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || '请求未能完成，请稍后再试。');
  return data;
}

function Evidence({ value }: { value: Fact | null }) {
  if (!value) return <p className="unknown">来源未说明</p>;
  return (
    <>
      <p>{value.text}</p>
      <details className="quote-details">
        <summary>
          查看依据 <ChevronDown size={13} />
        </summary>
        <blockquote>{value.quote}</blockquote>
      </details>
    </>
  );
}

function SourceLink({ source }: { source: Source }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="source-link"
    >
      知乎原文 <ArrowUpRight size={14} />
    </a>
  );
}

function ExperienceCard({
  item,
  source,
  focused,
}: {
  item: Experience;
  source: Source;
  focused: boolean;
}) {
  return (
    <article
      id={`case-${item.id}`}
      className={`experience ${focused ? 'focused' : ''}`}
    >
      <div className="experience-top">
        <span className={`result-label ${item.result}`}>
          {item.result === 'success' ? (
            <CheckCircle2 size={15} />
          ) : item.result === 'setback' ? (
            <TriangleAlert size={15} />
          ) : (
            <CircleHelp size={15} />
          )}{' '}
          {resultLabels[item.result]}
        </span>
        <span className="meta">{kindLabels[item.kind]}</span>
      </div>
      <h3>{source.title.replace(/\s*-\s*知乎$/, '')}</h3>
      <div className="author-row">
        <span>{source.author}</span>
        {source.badge && <span>{source.badge}</span>}
        <SourceLink source={source} />
      </div>
      <div className="experience-facts">
        <div>
          <h4>当时的条件</h4>
          <Evidence value={item.background} />
        </div>
        <div>
          <h4>采取的行动</h4>
          <Evidence value={item.action} />
        </div>
        <div>
          <h4>阶段结果</h4>
          <Evidence value={item.outcome} />
        </div>
      </div>
      <div className={`comparison ${item.comparison.status}`}>
        <div className="comparison-label">
          <SlidersHorizontal size={15} />
          <strong>与你的对照</strong>
          <span>
            {item.comparison.status === 'different'
              ? '存在条件差异'
              : item.comparison.status === 'similar'
                ? '部分条件相似'
                : '信息不足'}
          </span>
        </div>
        <p>{item.comparison.text}</p>
        {item.comparison.quote && (
          <details className="quote-details">
            <summary>
              核对双方条件 <ChevronDown size={13} />
            </summary>
            <p>你提供的条件：{item.comparison.userQuote}</p>
            <blockquote>{item.comparison.quote}</blockquote>
          </details>
        )}
      </div>
      {item.missing.length > 0 && (
        <p className="missing-note">来源未说明：{item.missing.join('、')}</p>
      )}
    </article>
  );
}

function Followup({
  question,
  onAnswer,
  onSkip,
  onSource,
}: {
  question: Question;
  onAnswer: (answer: string) => void;
  onSkip: () => void;
  onSource: () => void;
}) {
  const [answer, setAnswer] = useState('');
  return (
    <div className="followup">
      <h4>{question.question}</h4>
      <p>{question.reason}</p>
      <button className="text-button" onClick={onSource}>
        查看相关经历 <ArrowUpRight size={14} />
      </button>
      <div className="answer-options">
        {question.options.map((option) => (
          <button
            key={option}
            className={answer === option ? 'selected' : ''}
            onClick={() => setAnswer(option)}
          >
            {option}
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor={`answer-${question.sourceId}`}>
        补充你的情况
      </label>
      <input
        id={`answer-${question.sourceId}`}
        value={answer}
        maxLength={400}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="也可以补充自己的情况"
      />
      <div className="followup-actions">
        <button
          className="primary"
          disabled={!answer.trim()}
          onClick={() => onAnswer(answer)}
        >
          补充并更新 <ArrowRight size={15} />
        </button>
        <button className="text-button" onClick={onSkip}>
          暂时跳过
        </button>
      </div>
    </div>
  );
}

function ProfileDialog({
  profile,
  onClose,
  onSave,
}: {
  profile: Profile;
  onClose: () => void;
  onSave: (profile: Profile) => void;
}) {
  const [draft, setDraft] = useState(profile);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="profile-dialog" onCancel={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
        }}
      >
        <div className="dialog-heading">
          <h2>调整你的条件</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            title="关闭"
            aria-label="关闭"
          >
            <X size={20} />
          </button>
        </div>
        <p className="muted">{profile.question}</p>
        <ProfileFields profile={draft} onChange={setDraft} />
        {Object.entries(draft.answers).map(([q, a]) => (
          <label className="field-label" key={q}>
            {q}
            <input
              value={a}
              maxLength={400}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  answers: { ...draft.answers, [q]: e.target.value },
                })
              }
            />
          </label>
        ))}
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary">
            更新经验对照 <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </dialog>
  );
}

function ProfileFields({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (value: Profile) => void;
}) {
  return (
    <div className="profile-fields">
      <label className="field-label">
        你目前的背景与基础
        <input
          value={profile.background}
          maxLength={400}
          placeholder="例如：文科本科，工作三年，没有编程基础"
          onChange={(e) => onChange({ ...profile, background: e.target.value })}
        />
      </label>
      <label className="field-label">
        你能投入多少时间？
        <input
          value={profile.time}
          maxLength={400}
          placeholder="例如：继续工作，每天两小时，周末半天"
          onChange={(e) => onChange({ ...profile, time: e.target.value })}
        />
      </label>
      <label className="field-label">
        你的目标与现实限制
        <input
          value={profile.goal}
          maxLength={400}
          placeholder="例如：六个月内找到工作，不能中断收入"
          onChange={(e) => onChange({ ...profile, goal: e.target.value })}
        />
      </label>
    </div>
  );
}

export default function Workspace() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [step, setStep] = useState<'start' | 'conditions' | 'explore'>('start');
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pathId, setPathId] = useState('');
  const [filter, setFilter] = useState('all');
  const [focus, setFocus] = useState('');
  const [editing, setEditing] = useState(false);
  const [availability, setAvailability] = useState<{
    quota: { APIID: string; RemainingQuota: number }[] | null;
    archive: boolean;
  } | null>(null);
  const [showKeys, setShowKeys] = useState(false);
  const [zhihuKeyDraft, setZhihuKeyDraft] = useState('');
  const [aiKeyDraft, setAiKeyDraft] = useState('');
  const [overrideStatus, setOverrideStatus] = useState<{
    zhihu: string | null;
    ai: string | null;
  } | null>(null);
  const [keysSaving, setKeysSaving] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const activeRequest = useRef(false);
  const snapshot = useRef({ profile, job });
  useEffect(() => {
    snapshot.current = { profile, job };
  }, [profile, job]);

  useEffect(() => {
    const ac = new AbortController();
    request<{
      quota: { APIID: string; RemainingQuota: number }[] | null;
      archive: boolean;
    }>('/api/branches/health', { signal: ac.signal })
      .then(setAvailability)
      .catch(() => {});
    return () => ac.abort();
  }, []);

  async function openArchive() {
    if (activeRequest.current) return;
    setError('');
    setBusy(true);
    try {
      const saved = await request<Job>('/api/branches/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      setJob(saved);
      setProfile(saved.profile);
      setPathId(saved.result?.paths[0]?.id || '');
      setFilter('all');
      setFocus('');
      setStep('explore');
    } catch (e) {
      setError(e instanceof Error ? e.message : '历史样本暂不可用。');
    } finally {
      setBusy(false);
    }
  }

  async function refreshOverrides() {
    try {
      const s = await request<{
        provider: string;
        devOverride: { zhihu: string | null; ai: string | null };
      }>('/api/branches/settings');
      setOverrideStatus(s.devOverride);
    } catch {
      setOverrideStatus(null);
    }
  }

  async function saveTempKey(kind: 'zhihu' | 'ai', value: string) {
    setKeysSaving(true);
    setError('');
    try {
      const s = await request<{
        ok: boolean;
        devOverride: { zhihu: string | null; ai: string | null };
      }>('/api/branches/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: kind, value }),
      });
      if (kind === 'zhihu') setZhihuKeyDraft('');
      else setAiKeyDraft('');
      setOverrideStatus(s.devOverride);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存密钥失败。');
    } finally {
      setKeysSaving(false);
    }
  }

  useEffect(() => () => controller.current?.abort(), []);

  const explore = useCallback(
    async (nextProfile: Profile, previousId?: string) => {
      if (activeRequest.current) return;
      activeRequest.current = true;
      const before = snapshot.current;
      let accepted = false;
      controller.current?.abort();
      const ac = new AbortController();
      controller.current = ac;
      setBusy(true);
      setError('');
      setStep('explore');
      setEditing(false);
      setProfile(nextProfile);
      setJob(null);
      setFocus('');
      setFilter('all');
      try {
        const created = await request<{ id: string }>('/api/branches/explore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile: nextProfile, previousId }),
          signal: ac.signal,
        });
        accepted = true;
        const deadline = Date.now() + 240000;
        while (!ac.signal.aborted) {
          const current: Job = await request(
            `/api/branches/jobs/${created.id}`,
            { signal: ac.signal },
          );
          setJob(current);
          if (current.status !== 'running') {
            if (current.error) setError(current.error);
            setPathId(current.result?.paths[0]?.id || '');
            return current;
          }
          if (Date.now() > deadline)
            throw new Error('等待时间较长，请稍后重试。');
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      } catch (e) {
        if (!ac.signal.aborted) {
          setError(e instanceof Error ? e.message : '连接暂时中断，请重试。');
          if (!accepted && before.job) {
            setJob(before.job);
            setProfile(before.profile);
          }
        }
      } finally {
        if (!ac.signal.aborted) setBusy(false);
        activeRequest.current = false;
      }
    },
    [],
  );

  const path =
    job?.result?.paths.find((p) => p.id === pathId) || job?.result?.paths[0];
  const paths = useMemo(() => job?.result?.paths || [], [job?.result?.paths]);
  const cases = path?.cases || [];
  const selectedCases = cases.filter(
    (c) => filter === 'all' || c.result === filter,
  );
  const sourceMap = new Map(job?.sources.map((s) => [s.id, s]));
  const questions = (job?.result?.questions || []).filter(
    (q) =>
      !profile.skipped.includes(q.question) && !profile.answers[q.question],
  );
  const insights = (job?.result?.insights || []).filter((i) =>
    cases.some((c) => c.id === i.sourceId),
  );
  const jump = (id: string) => {
    const target = paths.find((p) => p.cases.some((c) => c.id === id));
    if (target) {
      setPathId(target.id);
      setFilter('all');
      setFocus(id);
      setTimeout(
        () =>
          document
            .getElementById(`case-${id}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
        100,
      );
    }
  };

  useEffect(() => {
    type Context = {
      registerTool: (
        tool: {
          name: string;
          description: string;
          inputSchema: object;
          annotations: object;
          execute: (input: unknown) => unknown;
        },
        options: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      {
        name: 'read_life_branch_exploration',
        description: '读取当前探索的选择、条件和行动路径。',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => ({
          profile,
          status: job?.status || step,
          paths: paths.map((p) => ({
            id: p.id,
            name: p.name,
            count: p.cases.length,
          })),
        }),
      },
      {
        name: 'select_life_branch_path',
        description: '选择已有行动路径并显示其经验详情。',
        inputSchema: {
          type: 'object',
          properties: { pathId: { type: 'string' } },
          required: ['pathId'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input: unknown) => {
          const id = (input as { pathId?: string })?.pathId;
          const selected = paths.find((p) => p.id === id);
          if (!selected || busy) throw new Error('路径不存在或探索尚未完成');
          setPathId(selected.id);
          setFilter('all');
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
          return { selectedPath: selected.name };
        },
      },
    ];
    for (const tool of tools) {
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    }
    return () => lifecycle.abort();
  }, [profile, job, step, busy, paths]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <GitBranch size={26} />
          <strong>人生分枝</strong>
          <span>经验探索</span>
        </div>
        <div className="header-right">
          <span className="source-label">
            <span className="live-dot" />
            知乎公开内容
          </span>
          <button
            aria-haspopup="dialog"
            aria-expanded={showKeys}
            onClick={() => {
              setShowKeys((v) => !v);
              if (!showKeys) void refreshOverrides();
            }}
            title="开发期临时切换密钥"
            className="key-toggle"
          >
            <SlidersHorizontal size={15} />
            开发者密钥
          </button>
          {step === 'explore' && (
            <button
              disabled={busy}
              onClick={() => {
                setStep('start');
                setProfile(emptyProfile);
                setJob(null);
                setError('');
              }}
            >
              <Plus size={16} />
              新的选择
            </button>
          )}
        </div>
        {showKeys && (
          <section
            className="key-panel"
            aria-label="开发期临时密钥"
          >
            <div className="key-panel-title">
              <strong>开发期临时密钥</strong>
              <span>仅保存在本服务进程内存，刷新 / 重启即清除</span>
            </div>
            <label className="key-field">
              <span>知乎 Access Secret {overrideStatus?.zhihu ? <em>（已注入 {overrideStatus.zhihu}）</em> : <em>（未注入 → 用本机默认）</em>}</span>
              <input
                type="password"
                autoComplete="off"
                value={zhihuKeyDraft}
                placeholder="留空并点清除则恢复本机 keychain"
                onChange={(e) => setZhihuKeyDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void saveTempKey('zhihu', zhihuKeyDraft);
                  }
                }}
              />
              <div className="key-actions">
                <button disabled={keysSaving} onClick={() => void saveTempKey('zhihu', zhihuKeyDraft)}>
                  {zhihuKeyDraft ? '注入该密钥' : '清除（用本机默认）'}
                </button>
              </div>
            </label>
            <label className="key-field">
              <span>搜索 / 分析 AI Key（DeepSeek 等）{overrideStatus?.ai ? <em>（已注入 {overrideStatus.ai}）</em> : <em>（未注入 → 用 .env.local / 环境变量）</em>}</span>
              <input
                type="password"
                autoComplete="off"
                value={aiKeyDraft}
                placeholder="留空并点清除则回退服务端配置"
                onChange={(e) => setAiKeyDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void saveTempKey('ai', aiKeyDraft);
                  }
                }}
              />
              <div className="key-actions">
                <button disabled={keysSaving} onClick={() => void saveTempKey('ai', aiKeyDraft)}>
                  {aiKeyDraft ? '注入该密钥' : '清除（用服务端配置）'}
                </button>
              </div>
            </label>
          </section>
        )}
      </header>
      {step !== 'explore' ? (
        <main className="start-page">
          {availability?.quota?.some((q) => q.RemainingQuota === 0) && (
            <div className="availability-note">
              <Clock3 size={17} />
              <span>今日部分知乎额度已用尽。可以先查看历史样本。</span>
              <a
                href="https://developer.zhihu.com/profile"
                target="_blank"
                rel="noopener noreferrer"
              >
                查看用量 <ArrowUpRight size={13} />
              </a>
            </div>
          )}
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <div className="eyebrow">
            {step === 'start' ? '一个选择，不同走法' : '把经验放回你的处境'}
          </div>
          <h1>
            {step === 'start' ? '你正在考虑什么选择？' : '先了解一点你的情况'}
          </h1>
          {step === 'start' ? (
            <>
              <form
                className="question-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (profile.question.trim().length >= 2)
                    setStep('conditions');
                }}
              >
                <label htmlFor="choice">当前选择</label>
                <textarea
                  id="choice"
                  required
                  minLength={2}
                  maxLength={240}
                  value={profile.question}
                  onChange={(e) =>
                    setProfile({ ...profile, question: e.target.value })
                  }
                  placeholder="例如：非科班，在职，想转行做开发"
                />
                <div className="form-footer">
                  <span className="muted">一次探索一个选择</span>
                  <button
                    className="primary"
                    disabled={profile.question.trim().length < 2}
                  >
                    继续 <ArrowRight size={18} />
                  </button>
                </div>
              </form>
              {availability?.archive && (
                <button
                  className="archive-entry"
                  type="button"
                  disabled={busy}
                  onClick={() => void openArchive()}
                >
                  <BookOpen size={19} />
                  <span>
                    <strong>查看已整理的真实经历</strong>
                    <small>
                      2026-09-05 历史检索片段 · 虚构人物条件 · 非实时分析
                    </small>
                  </span>
                  <ArrowRight size={18} />
                </button>
              )}
              <div className="example-section">
                <p className="muted">从一个具体选择开始</p>
                <div className="example-choices">
                  {exampleChoices.map((choice, i) => (
                    <button
                      key={choice}
                      onClick={() => {
                        setProfile({ ...emptyProfile, question: choice });
                        setStep('conditions');
                      }}
                    >
                      <span className="example-index">0{i + 1}</span>
                      {choice}
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="start-bottom">
                <GitBranch size={44} />
                <p>
                  每一条路径，回到真实经历。
                  <br />
                  看见做法，也看见代价。
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="current-question">{profile.question}</p>
              <p className="muted">只补充尚未说过的条件，不确定的可以留空。</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void explore(profile);
                }}
              >
                <ProfileFields profile={profile} onChange={setProfile} />
                <div className="form-footer">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setStep('start')}
                  >
                    <ArrowLeft size={16} />
                    修改选择
                  </button>
                  <button className="primary">
                    <Search size={17} />
                    搜索真实经历
                  </button>
                </div>
              </form>
            </>
          )}
        </main>
      ) : (
        <main className="workspace">
          {job?.historical && (
            <div className="availability-note archive-note">
              <BookOpen size={18} />
              <span>
                历史检索样本 · {job.retrievedAt || '2026-09-05'} ·{' '}
                {job.curated
                  ? '基于真实片段整理，非实时模型输出'
                  : '历史分析结果'}{' '}
                · 人物条件为虚构示例
              </span>
            </div>
          )}
          <section className="choice-header">
            <div>
              <div className="eyebrow">当前选择</div>
              <h1>{profile.question}</h1>
            </div>
            <button
              className="icon-button"
              title="修改条件"
              aria-label="修改条件"
              disabled={busy}
              onClick={() => setEditing(true)}
            >
              <Pencil size={18} />
            </button>
            <div className="condition-line">
              {[
                ['背景', profile.background],
                ['投入', profile.time],
                ['目标', profile.goal],
              ].map(([label, value]) => (
                <span key={label}>
                  <b>{label}</b>
                  {value || '未补充'}
                </span>
              ))}
              {Object.entries(profile.answers).map(([q, a]) => (
                <span key={q} title={q}>
                  <Check size={13} />
                  {a}
                </span>
              ))}
            </div>
          </section>
          {busy ? (
            <section className="loading-region" aria-live="polite">
              <div className="loading-symbol">
                <GitBranch size={32} />
                <LoaderCircle className="spin" size={52} />
              </div>
              <h2>{job?.progress || '正在开始探索…'}</h2>
              <p className="muted">
                {job?.sources.length
                  ? `已找到 ${job.sources.length} 个来源，正在整理可对照的经历。`
                  : '先寻找走过这条路的人。'}
              </p>
              <div className="progress-steps">
                <span className={job?.sources.length ? 'complete' : 'active'}>
                  01 检索正反经历
                </span>
                <ChevronRight size={15} />
                <span className={job?.sources.length ? 'active' : ''}>
                  02 整理行动路径
                </span>
                <ChevronRight size={15} />
                <span>03 核对证据</span>
              </div>
            </section>
          ) : (
            <>
              {error && (
                <div className="error-banner" role="alert">
                  <TriangleAlert size={20} />
                  <div>
                    <strong>这次探索还未完成</strong>
                    <p>{error}</p>
                  </div>
                  <button
                    onClick={() =>
                      void explore(
                        profile,
                        job?.sources.length ? job.id : undefined,
                      )
                    }
                  >
                    重试{job?.sources.length ? '分析' : '搜索'}
                  </button>
                </div>
              )}
              {paths.length ? (
                <div className="exploration-layout">
                  <aside className="path-sidebar">
                    <div className="sidebar-heading">
                      <GitBranch size={17} />
                      <h2>行动路径</h2>
                      <span>{paths.length}</span>
                    </div>
                    <div className="tree-root">
                      <span className="root-dot" />
                      这个选择
                    </div>
                    <nav aria-label="行动路径">
                      {paths.map((p, i) => (
                        <button
                          aria-current={p.id === path?.id ? 'true' : undefined}
                          className={`path-node ${p.id === path?.id ? 'active' : ''}`}
                          key={p.id}
                          onClick={() => {
                            setPathId(p.id);
                            setFilter('all');
                            setFocus('');
                          }}
                        >
                          <span className="node-dot" />
                          <div>
                            <span className="path-number">
                              路径 {String(i + 1).padStart(2, '0')}
                            </span>
                            <strong>{p.name}</strong>
                            <small>
                              {p.cases.length} 段经历 ·{' '}
                              {
                                p.cases.filter((c) => c.result === 'success')
                                  .length
                              }{' '}
                              项阶段达成
                            </small>
                          </div>
                          <ChevronRight size={15} />
                        </button>
                      ))}
                    </nav>
                    <div className="sidebar-note">
                      <ShieldCheck size={17} />
                      <p>
                        路径来自检索到的经历。
                        <br />
                        个人自述尚未经独立核实。
                      </p>
                    </div>
                  </aside>
                  <section className="path-detail">
                    <div className="detail-heading">
                      <div>
                        <div className="eyebrow">沿着这条路，看见不同结果</div>
                        <h2>{path?.name}</h2>
                      </div>
                      <span className="meta">{cases.length} 段经历</span>
                    </div>
                    <div className="insight-grid">
                      {(['practice', 'risk'] as const).map((type) => (
                        <section key={type}>
                          <h3>
                            {type === 'practice' ? (
                              <Sprout size={18} />
                            ) : (
                              <TriangleAlert size={18} />
                            )}{' '}
                            {type === 'practice'
                              ? '可参考的做法'
                              : '与你相关的风险'}
                          </h3>
                          {insights.filter((i) => i.type === type).length ? (
                            insights
                              .filter((i) => i.type === type)
                              .map((i, index) => (
                                <div className="insight" key={index}>
                                  <h4>{i.title}</h4>
                                  <p>{i.text}</p>
                                  <button
                                    className="text-button"
                                    onClick={() => jump(i.sourceId)}
                                  >
                                    对应经历 <ArrowUpRight size={13} />
                                  </button>
                                  <details className="quote-details">
                                    <summary>
                                      原文依据 <ChevronDown size={13} />
                                    </summary>
                                    <blockquote>{i.quote}</blockquote>
                                  </details>
                                </div>
                              ))
                          ) : (
                            <p className="muted empty-insight">
                              现有证据不足，暂不作判断。
                            </p>
                          )}
                        </section>
                      ))}
                    </div>
                    <section className="cases-section">
                      <div className="cases-heading">
                        <h3>经验对照</h3>
                        <span className="meta">
                          同一条路，条件与结果可能不同
                        </span>
                      </div>
                      <fieldset
                        className="result-filters"
                        aria-label="筛选经历结果"
                      >
                        {[
                          ['all', '全部'],
                          ['success', '阶段达成'],
                          ['setback', '阶段受挫'],
                          ['mixed', '有得有失'],
                          ['unknown', '结果未明'],
                        ].map(([key, label]) => (
                          <button
                            aria-pressed={filter === key}
                            key={key}
                            className={filter === key ? 'active' : ''}
                            onClick={() => setFilter(key)}
                          >
                            {label}
                            <span>
                              {key === 'all'
                                ? cases.length
                                : cases.filter((c) => c.result === key).length}
                            </span>
                          </button>
                        ))}
                      </fieldset>
                      {selectedCases.length ? (
                        selectedCases.map((c) => (
                          <ExperienceCard
                            key={c.id}
                            item={c}
                            source={sourceMap.get(c.id)!}
                            focused={focus === c.id}
                          />
                        ))
                      ) : (
                        <div className="empty-results">
                          <CircleHelp size={25} />
                          <h3>这一路径下，暂未找到此类经历</h3>
                          <p>当前样本没有覆盖这一侧，不能据此判断它不存在。</p>
                          <button onClick={() => setFilter('all')}>
                            查看全部经历
                          </button>
                        </div>
                      )}
                    </section>
                  </section>
                  <aside className="questions-sidebar">
                    <div className="sidebar-heading">
                      <CircleHelp size={18} />
                      <h2>还需确认</h2>
                    </div>
                    {questions.length ? (
                      questions.map((q) => (
                        <Followup
                          key={q.question}
                          question={q}
                          onSource={() => jump(q.sourceId)}
                          onSkip={() =>
                            setProfile({
                              ...profile,
                              skipped: [...profile.skipped, q.question],
                            })
                          }
                          onAnswer={(answer) =>
                            void explore(
                              {
                                ...profile,
                                answers: {
                                  ...profile.answers,
                                  [q.question]: answer,
                                },
                              },
                              job?.id,
                            )
                          }
                        />
                      ))
                    ) : (
                      <div className="no-questions">
                        <CheckCircle2 size={22} />
                        <p>目前没有新的关键补问。</p>
                        <span className="meta">
                          这不代表信息已完整。每段经历中仍可能有来源未说明的条件。
                        </span>
                      </div>
                    )}
                    <button
                      className="edit-conditions"
                      onClick={() => setEditing(true)}
                    >
                      <SlidersHorizontal size={16} />
                      修改已填写条件
                    </button>
                  </aside>
                </div>
              ) : (
                !error && (
                  <section className="empty-results large">
                    <GitBranch size={36} />
                    <h2>
                      {job?.sources.length
                        ? '找到来源，但尚不足以形成行动路径'
                        : '暂未找到相关经历'}
                    </h2>
                    <p>
                      {job?.sources.length
                        ? '可以查看下方原始片段，或重试分析。系统没有补造路径与结果。'
                        : '尝试把选择写得更具体，例如目标专业、岗位或国家。'}
                    </p>
                    <button onClick={() => setStep('start')}>
                      <Pencil size={16} />
                      调整选择
                    </button>
                    {Boolean(job?.sources.length) && (
                      <button onClick={() => void explore(profile, job?.id)}>
                        重新分析
                      </button>
                    )}
                  </section>
                )
              )}
              {Boolean(job?.sources.length) && (
                <details className="sources-section">
                  <summary>
                    <BookOpen size={17} />
                    本次检索来源 · {job?.sources.length}
                    <ChevronDown size={16} />
                    <span className="meta">包含未纳入路径的内容</span>
                  </summary>
                  <div className="source-list">
                    {job?.sources.map((s) => (
                      <article key={s.id}>
                        <div>
                          <h3>{s.title}</h3>
                          <SourceLink source={s} />
                        </div>
                        <p className="meta">
                          {s.author} ·{' '}
                          {s.editTime
                            ? `发布或更新时间：${new Date(s.editTime * 1000).toLocaleDateString('zh-CN')}`
                            : '时间未知'}
                        </p>
                        {s.snippets.map((excerpt, i) => (
                          <details key={i}>
                            <summary>检索片段 {i + 1}</summary>
                            <p className="raw-excerpt">{excerpt}</p>
                          </details>
                        ))}
                      </article>
                    ))}
                  </div>
                </details>
              )}
              <footer className="workspace-footer">
                <ShieldCheck size={15} />
                <span>依据搜索片段整理 · 非完整原文 · 不代表成功率</span>
                {Boolean(job?.result?.rejected) && (
                  <span>已移除 {job?.result?.rejected} 项无有效引用的分析</span>
                )}
              </footer>
            </>
          )}
        </main>
      )}
      {editing && (
        <ProfileDialog
          profile={profile}
          onClose={() => setEditing(false)}
          onSave={(p) =>
            void explore(p, job?.sources.length ? job.id : undefined)
          }
        />
      )}
    </div>
  );
}
