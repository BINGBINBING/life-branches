'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { dictionaryIndex } from '../server/condition-dictionary.mjs';
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
  History,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sprout,
  TriangleAlert,
  Trash2,
  X,
} from 'lucide-react';
import type {
  Experience,
  Fact,
  IntakePlan,
  Job,
  Profile,
  Question,
  ResearchSummary,
  Source,
} from '../lib/branch-types';

const emptyProfile: Profile = {
  question: '',
  background: '',
  time: '',
  goal: '',
  conditionAnswers: {},
  decisionScope: '',
  decisionPath: '',
  decisionSector: '',
  answers: {},
  skipped: [],
};
// “自由补充”在 profile.answers 中的内部固定键，不会当作补问展示。
const FREE_NOTE_KEY = '__自由补充__';
// 浏览器本地历史探索（结果快照）存储键与上限。
const HISTORY_KEY = 'lb-browser-history-v1';
const HISTORY_MAX = 20;

function readHistoryLocal(): Job[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Job[];
    return Array.isArray(parsed) ? parsed.filter((j) => j && j.profile) : [];
  } catch {
    return [];
  }
}

function writeHistoryLocal(list: Job[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    // 容量超限：去掉最旧一条再试一次，仍失败则放弃。
    try {
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(list.slice(0, HISTORY_MAX - 1)),
      );
    } catch {}
  }
}
const exampleChoices = [
  '非科班，在职，想转行做开发',
  '工作三年，想从运营转行做产品经理',
  '本科计算机，想跨专业考心理学研究生',
  '想从工科转到设计专业',
];
const resultLabels = {
  success: '正向阶段已核对',
  setback: '受挫阶段已核对',
  mixed: '有得有失',
  unknown: '结果待核实',
};
const kindLabels = {
  unknown: '内容性质待核实',
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
      <p>{value.verification === 'model-reviewed' && value.semanticReviewVersion === 'ds-content-1' ? value.text : '暂未形成可靠归纳'}</p>
      <p className="meta">{value.verification === 'model-reviewed' && value.semanticReviewVersion === 'ds-content-1' ? 'AI 总结，已通过模型证据复核，仍需人工判断' : '原始材料仅供核对，不作为本栏结论。旧记录需重新发起研究才能生成新归纳。'}</p>
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
        {item.stage && (
          <span className="meta">当前最远可验证阶段：{item.stage.label}</span>
        )}
      </div>
      <h3>{source.title.replace(/\s*-\s*知乎$/, '')}</h3>
      <p className="meta">仅依据检索摘要 · 未核验全文及事件真实性，可能缺少否定、转折或后续结果。</p>
      {item.classification && <p className="meta">{item.classification.reason}</p>}
      {item.classification?.promotionQuote && <details className="quote-details"><summary>推广信号依据 <ChevronDown size={13} /></summary><blockquote>{item.classification.promotionQuote}</blockquote></details>}
      {!!item.actionTags?.length && <p className="meta">引文中的行动：{item.actionTags.map((tag) => tag.label).join('、')}。主分枝仅用于归类，不代表唯一做法。</p>}
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
          <h4>{item.stage ? '当前最远可验证阶段' : '结果仍待核实'}</h4>
          {item.stage ? (
            <>
              <strong>{item.stage.label}</strong>
              <details className="quote-details"><summary>阶段依据 <ChevronDown size={13} /></summary><blockquote>{item.stage.quote}</blockquote></details>
              <p className="meta">
                {item.stage.scopeNote ||
                  '仅说明这一阶段，不代表整个选择成功或失败。'}
              </p>
              <Evidence value={item.outcome} />
            </>
          ) : (
            <Evidence value={item.outcome} />
          )}
        </div>
      </div>
      {item.conditionComparisons?.length ? (
        <div>
          {item.conditionComparisons.filter((condition) => condition.status === 'different').slice(0, 2).map((condition) => (
            <p key={condition.conditionId}><strong>{condition.label}：</strong>{condition.text}</p>
          ))}
        <details className="condition-comparisons">
          <summary className="comparison-label">
            <SlidersHorizontal size={15} />
            <strong>展开 {item.conditionComparisons.length} 项条件对照</strong>
            <ChevronDown size={15} />
          </summary>
          {item.conditionComparisons.map((condition) => (
            <div
              className="condition-comparison-row"
              key={condition.conditionId}
            >
              <div>
                <strong>{condition.label}</strong>
                <span className={`condition-status ${condition.status}`}>
                  {condition.status === 'different'
                    ? '条件不同'
                    : condition.status === 'similar'
                      ? '条件相同'
                      : '尚不可比'}
                </span>
              </div>
              <dl>
                <div>
                  <dt>你的条件</dt>
                  <dd>{condition.userValue || '未提供同口径数值'}</dd>
                </div>
                <div>
                  <dt>案例条件</dt>
                  <dd>{condition.caseValue}</dd>
                </div>
              </dl>
              <p>{condition.text}</p>
              <details className="quote-details">
                <summary>
                  查看条件依据 <ChevronDown size={13} />
                </summary>
                {condition.userQuote && <p>你的原话：{condition.userQuote}</p>}
                <blockquote>{condition.quote}</blockquote>
              </details>
            </div>
          ))}
        </details>
        </div>
      ) : (
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
      )}
      {item.missing.length > 0 && (
        <p className="missing-note">来源未说明：{item.missing.join('、')}</p>
      )}
    </article>
  );
}

function DynamicConditionDialog({ open, onClose, children }: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="profile-dialog" aria-labelledby="dynamic-title" onCancel={onClose}>
      <div className="dialog-heading">
        <h2 id="dynamic-title">补充本次研究的条件</h2>
        <button type="button" onClick={onClose}>稍后处理</button>
      </div>
      {children}
    </dialog>
  );
}

function DynamicConditionForm({
  questions,
  onSubmit,
  onSource,
}: {
  questions: Question[];
  onSubmit: (answers: Record<string, string>, skipped: string[]) => void;
  onSource: (sourceId: string) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState<string[]>([]);
  const update = (question: string, answer: string) => {
    setAnswers((current) => ({ ...current, [question]: answer }));
    setSkipped((current) => current.filter((item) => item !== question));
  };
  const hasChanges =
    Object.values(answers).some((answer) => answer.trim()) ||
    skipped.length > 0;
  return (
    <form
      className="dynamic-condition-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(answers, skipped);
      }}
    >
      {questions.map((question) => {
        const answer = answers[question.question] || '';
        const isSkipped = skipped.includes(question.question);
        return (
          <fieldset className="followup" key={question.question}>
            <legend>{question.question}</legend>
            <p className="meta">{question.origin === 'basic' ? '基础条件待补齐' : '经历证据触发'}</p>
            <p>{question.reason}</p>
            {question.origin !== 'basic' && <details className="quote-details">
              <summary>触发这次补问的原文 <ChevronDown size={13} /></summary>
              <blockquote>{question.quote}</blockquote>
            </details>}
            <p className="meta">
              回答后会更新已有经历中这一条件的对照及相关提示；暂不回答则保持待确认。本次更新不重新搜索或调用分析模型。
            </p>
            {question.origin !== 'basic' && <button
              type="button"
              className="text-button"
              onClick={() => onSource(question.sourceId)}
            >
              查看相关经历 <ArrowUpRight size={14} />
            </button>}
            <div className="answer-options">
              {question.options.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={answer === option ? 'selected' : ''}
                  onClick={() => update(question.question, option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor={`answer-${encodeURIComponent(question.question)}`}>
              补充你的情况
            </label>
            <input
              id={`answer-${encodeURIComponent(question.question)}`}
              value={answer}
              maxLength={400}
              disabled={isSkipped}
              onChange={(event) =>
                update(question.question, event.target.value)
              }
              placeholder="也可以补充自己的情况"
            />
            <label className="followup-skip">
              <input
                type="checkbox"
                checked={isSkipped}
                onChange={(event) => {
                  setSkipped((current) =>
                    event.target.checked
                      ? [...new Set([...current, question.question])]
                      : current.filter((item) => item !== question.question),
                  );
                  if (event.target.checked)
                    setAnswers((current) => ({
                      ...current,
                      [question.question]: '',
                    }));
                }}
              />
              本轮暂不回答
            </label>
          </fieldset>
        );
      })}
      <div className="followup-actions">
        <button className="primary" disabled={!hasChanges}>
          更新条件对照 <ArrowRight size={15} />
        </button>
      </div>
    </form>
  );
}

function FeedbackCard({
  jobId,
  question,
}: {
  jobId: string | null;
  question: string;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [phase, setPhase] = useState<'idle' | 'saving' | 'sent'>('idle');
  const [error, setError] = useState('');

  async function submit() {
    if (rating < 1 || phase === 'saving') return;
    setPhase('saving');
    setError('');
    try {
      await request<{ ok: boolean }>('/api/branches/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          comment,
          question,
          jobId,
        }),
      });
      setPhase('sent');
    } catch (e) {
      setError(e instanceof Error ? e.message : '反馈提交失败。');
      setPhase('idle');
    }
  }

  if (phase === 'sent')
    return (
      <div className="feedback-card">
        <p className="feedback-thanks">
          感谢反馈 🌱 我们会用你的意见改进体验。
        </p>
        <button
          type="button"
          className="text-button"
          onClick={() => setPhase('idle')}
        >
          再评一次
        </button>
      </div>
    );

  return (
    <div className="feedback-card">
      <div className="feedback-head">
        <strong>这次体验如何？</strong>
        <span>1–5 星 + 可选评论</span>
      </div>
      <div className="star-row" aria-label="评分">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} 星`}
            aria-pressed={rating === n}
            className={rating >= n ? 'on' : ''}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <textarea
            rows={2}
            maxLength={2000}
            value={comment}
            placeholder="想说点什么？（可选）"
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="feedback-actions">
            <button
              type="button"
              className="primary"
              disabled={phase === 'saving'}
              onClick={() => void submit()}
            >
              {phase === 'saving' ? '提交中…' : '提交反馈'}
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function HistoryDialog({
  history,
  onOpen,
  onDelete,
  onClose,
}: {
  history: Job[];
  onOpen: (entry: Job) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="history-dialog"
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="history-head">
        <strong>当前设备快速历史</strong>
        <span className="meta">仅此浏览器 · 删除不影响服务端研究版本</span>
        <button
          type="button"
          className="icon-button"
          title="关闭"
          aria-label="关闭"
          onClick={() => ref.current?.close()}
        >
          <X size={18} />
        </button>
      </div>
      {history.length ? (
        <ul className="history-list">
          {history.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="history-entry"
                onClick={() => onOpen(h)}
              >
                <span className="history-question">{h.profile.question}</span>
                <span className="history-meta">
                  {new Date(h.createdAt).toLocaleString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                  {' · '}
                  {h.result?.paths?.length || 0} 条路径
                  {' · '}
                  {h.sources?.length || 0} 篇来源
                  {h.reused ? ' · 复用来源' : ''}
                </span>
              </button>
              <button
                type="button"
                className="history-delete"
                title="删除"
                aria-label="删除该条历史"
                onClick={() => onDelete(h.id)}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ padding: '18px 4px' }}>
          还没有保存的探索。完成一次实时搜索后会自动出现在这里。
        </p>
      )}
    </dialog>
  );
}

function ProfileDialog({
  profile,
  intake,
  onClose,
  onSave,
  showFreeNote = false,
}: {
  profile: Profile;
  intake: IntakePlan | null;
  onClose: () => void;
  onSave: (profile: Profile) => void;
  showFreeNote?: boolean;
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
          // 丢弃空答案（含被清空的自由补充），避免把空文本交给分析与补问。
          const cleaned = {
            ...draft,
            answers: Object.fromEntries(
              Object.entries(draft.answers).filter(([, v]) => v.trim() !== ''),
            ),
          };
          onSave(cleaned);
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
        {intake ? (
          <IntakeFields plan={intake} profile={draft} onChange={setDraft} />
        ) : (
          <ProfileFields profile={draft} onChange={setDraft} />
        )}
        {showFreeNote && (
          <label className="field-label">
            自由补充（可选）
            <textarea
              rows={3}
              maxLength={400}
              placeholder="没有待确认的问题时，也可以在这里补充任何想说明的情况…"
              value={draft.answers[FREE_NOTE_KEY] ?? ''}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  answers: {
                    ...draft.answers,
                    [FREE_NOTE_KEY]: e.target.value,
                  },
                })
              }
            />
          </label>
        )}
        {Object.entries(draft.answers)
          .filter(([q]) => q !== FREE_NOTE_KEY)
          .map(([q, a]) => (
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

function IntakeFields({
  plan,
  profile,
  onChange,
}: {
  plan: IntakePlan;
  profile: Profile;
  onChange: (value: Profile) => void;
}) {
  const unitFor = (id: string) => {
    return ({
      daily_time: '小时/天', weekly_hours: '小时/周', continuous_session: '小时/次',
      preparation_months: '个月', enrollment_year: '年', policy_year: '年',
      current_term: '学期', attempts_remaining: '次', gpa_value: '',
      rank_percentile: '%', rank_position: '名', failed_course_count: '门', incoming_quota: '人',
      recognized_credits: '学分', makeup_credits: '学分', graduation_delay: '个月',
      extra_tuition: '元', relevant_tenure: '年', application_count: '份',
      interview_count: '次', income_gap_months: '个月', commute_ceiling: '分钟/单程',
      notice_period: '天',
    } as Record<string, string>)[id];
  };
  const update = (id: string, value: string) =>
    onChange({
      ...profile,
      conditionAnswers: { ...profile.conditionAnswers, [id]: value },
    });
  const amountUnit = (id: string) =>
    id === 'salary_floor_amount' || id === 'monthly_essential_cost'
      ? '元/月'
      : '元';
  return (
    <div className="profile-fields">
      {plan.fields.map((field) => (
        <label className="field-label" key={field.id}>
          <span>
            {field.label}
            <small className="meta">
              {({
                通用原子条件: '时间与现实条件',
                学业路径原子条件: '学业背景与申请条件',
                职业路径原子条件: '职业背景与转行条件',
                岗位专项条件: '目标岗位要求',
              } as Record<string, string>)[field.group] || field.group}
            </small>
            <small
              className={`intake-field-status ${
                profile.conditionAnswers?.[field.id] ? 'recognized' : 'unanswered'
              }`}
            >
              {profile.conditionAnswers?.[field.id] === '尚未核实'
                ? '已标记未知'
                : profile.conditionAnswers?.[field.id]
                  ? field.initialValue === profile.conditionAnswers[field.id]
                    ? '已从描述识别，请确认'
                    : '已填写'
                  : '需要补充'}
            </small>
          </span>
          {profile.conditionAnswers?.[field.id] === '尚未核实' ? (
            <div aria-live="polite">
              <p>尚未核实</p>
              <button type="button" className="text-button" onClick={() => update(field.id, '')}>
                重新填写
              </button>
            </div>
          ) : field.answerType === 'multi_select' ? (
            <div className="multi-select-field">
              {(field.options || []).map((option) => {
                const values = (profile.conditionAnswers?.[field.id] || '')
                  .split('、')
                  .filter(Boolean);
                return (
                  <label key={option.value}>
                    <input
                      type="checkbox"
                      checked={values.includes(option.value)}
                      onChange={(e) =>
                        update(
                          field.id,
                          (e.target.checked
                            ? [...values, option.value]
                            : values.filter((value) => value !== option.value)
                          ).join('、'),
                        )
                      }
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
          ) : field.answerType === 'boolean' ? (
            <select
              value={profile.conditionAnswers?.[field.id] || ''}
              onChange={(e) => update(field.id, e.target.value)}
            >
              <option value="">请选择</option>
              <option value="是">是</option>
              <option value="否">否</option>
              <option value="尚未核实">尚未核实</option>
            </select>
          ) : field.answerType === 'single_choice' ? (
            <select
              value={profile.conditionAnswers?.[field.id] || ''}
              onChange={(e) => update(field.id, e.target.value)}
            >
              <option value="">请选择</option>
              {(field.options || []).map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
              {!field.options?.some(
                (option) => option.value === '尚未核实',
              ) && <option value="尚未核实">尚未核实</option>}
            </select>
          ) : field.answerType === 'amount' ? (
            <div className="amount-field">
              <input
                type="number"
                min="0"
                step="any"
                value={
                  profile.conditionAnswers?.[field.id]?.match(
                    /\d+(?:\.\d+)?/,
                  )?.[0] || ''
                }
                placeholder={field.question}
                onChange={(e) =>
                  update(
                    field.id,
                    e.target.value
                      ? `${e.target.value}${amountUnit(field.id)}`
                      : '',
                  )
                }
              />
              <span>{amountUnit(field.id)}</span>
            </div>
          ) : ['integer', 'number', 'duration'].includes(
              field.answerType,
            ) && unitFor(field.id) !== undefined ? (
            <div className="amount-field">
            <input
              type="number"
              min="0"
              step={field.answerType === 'integer' ? '1' : 'any'}
              value={
                profile.conditionAnswers?.[field.id]?.match(
                  /\d+(?:\.\d+)?/,
                )?.[0] || ''
              }
              placeholder={field.question}
              onChange={(e) =>
                update(
                  field.id,
                  e.target.value ? `${e.target.value}${unitFor(field.id)}` : '',
                )
              }
            />
              <span>
                {field.id === 'gpa_value'
                  ? `绩点（${profile.conditionAnswers?.gpa_scale || '分制待确认'}）`
                  : unitFor(field.id)}
              </span>
            </div>
          ) : ['duration', 'range'].includes(field.answerType) ? (
            <div>
              <input
                type="text"
                value={profile.conditionAnswers?.[field.id] || ''}
                maxLength={400}
                placeholder={field.question}
                onChange={(e) => update(field.id, e.target.value)}
              />
              <span className="meta">{unitFor(field.id) ? `单位：${unitFor(field.id)}，可填写区间` : '请注明频率、单位或范围'}</span>
            </div>
          ) : field.id === 'job_posting_text' ? (
            <textarea
              value={profile.conditionAnswers?.[field.id] || ''}
              maxLength={4000}
              placeholder={field.question}
              onChange={(e) => update(field.id, e.target.value)}
            />
          ) : (
            <input
              type={
                field.answerType === 'date'
                  ? 'date'
                  : field.answerType === 'url'
                    ? 'url'
                    : 'text'
              }
              value={profile.conditionAnswers?.[field.id] || ''}
              maxLength={400}
              placeholder={field.question}
              onChange={(e) => update(field.id, e.target.value)}
            />
          )}
          {profile.conditionAnswers?.[field.id] !== '尚未核实' && !['boolean', 'single_choice'].includes(field.answerType) && (
            <button
              className="field-unknown"
              type="button"
              onClick={() => update(field.id, '尚未核实')}
            >
              不知道 / 尚未核实
            </button>
          )}
        </label>
      ))}
      <label className="field-label">
        其他重要限制
        <input
          value={profile.goal}
          maxLength={400}
          placeholder="例如：不能中断收入，必须在六个月内做出决定"
          onChange={(e) => onChange({ ...profile, goal: e.target.value })}
        />
      </label>
    </div>
  );
}

export default function Workspace() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [step, setStep] = useState<'start' | 'conditions' | 'explore'>('start');
  const [intake, setIntake] = useState<IntakePlan | null>(null);
  const [starterText, setStarterText] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pathId, setPathId] = useState('');
  const [filter, setFilter] = useState('all');
  const [focus, setFocus] = useState('');
  const [editing, setEditing] = useState(false);
  const [dynamicOpen, setDynamicOpen] = useState(false);
  const [records, setRecords] = useState<ResearchSummary[]>([]);
  const [savedRecordId, setSavedRecordId] = useState('');
  const [feedbackDeletion, setFeedbackDeletion] = useState('');
  const [availability, setAvailability] = useState<{
    quota: { APIID: string; RemainingQuota: number }[] | null;
    archive: boolean;
    developerTools: boolean;
    privateResearch?: boolean;
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
      developerTools: boolean;
    }>('/api/branches/health', { signal: ac.signal })
      .then(setAvailability)
      .catch(() => {});
    return () => ac.abort();
  }, []);

  const refreshRecords = useCallback(async () => {
    try {
      const value = await request<{ records: ResearchSummary[] }>(
        '/api/branches/researches',
      );
      setRecords(value.records);
    } catch {}
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    request<{ records: ResearchSummary[] }>('/api/branches/researches', {
      signal: ac.signal,
    })
      .then((value) => setRecords(value.records))
      .catch(() => {});
    return () => ac.abort();
  }, []);

  async function saveResearch() {
    if (!job || job.status !== 'done') return;
    setError('');
    try {
      const saved = await request<ResearchSummary>('/api/branches/researches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      });
      setSavedRecordId(saved.id);
      await refreshRecords();
    } catch (e) {
      setError(e instanceof Error ? e.message : '研究记录保存失败。');
    }
  }

  async function openResearch(id: string) {
    setBusy(true);
    setError('');
    try {
      const saved = await request<Job>(`/api/branches/researches/${id}`);
      setJob(saved);
      setSavedRecordId(id);
      setProfile(saved.profile);
      setPathId(saved.result?.paths[0]?.id || '');
      setFilter('all');
      setFocus('');
      setIntake(null);
      setStep('explore');
    } catch (e) {
      setError(e instanceof Error ? e.message : '研究记录无法打开。');
    } finally {
      setBusy(false);
    }
  }

  async function removeResearch(id: string) {
    if (!window.confirm('删除这条服务端研究版本？不会删除当前浏览器的快速历史，此操作不能撤销。')) return;
    try {
      await request(`/api/branches/researches/${id}`, { method: 'DELETE' });
      if (savedRecordId === id) setSavedRecordId('');
      await refreshRecords();
    } catch (e) {
      setError(e instanceof Error ? e.message : '研究记录删除失败。');
    }
  }

  async function removeSessionFeedback() {
    if (busy || !window.confirm('删除当前会话提交的全部反馈？研究版本和匿名用量统计不会删除。此操作不能撤销。')) return;
    setBusy(true);
    setFeedbackDeletion('');
    try {
      const result = await request<{ removed: number }>('/api/branches/feedback', { method: 'DELETE' });
      setFeedbackDeletion(`已删除 ${result.removed} 条当前会话反馈。`);
    } catch (e) {
      setFeedbackDeletion(e instanceof Error ? e.message : '反馈删除失败，请重试。');
    } finally { setBusy(false); }
  }

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
      setSavedRecordId('');
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

  const [history, setHistory] = useState<Job[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // 浏览器本地读取最近探索快照（SSR 安全：仅在挂载后读取）。
  useEffect(() => {
    let ignore = false;
    void Promise.resolve().then(() => {
      if (ignore) return;
      setHistory(readHistoryLocal());
    });
    return () => {
      ignore = true;
    };
  }, []);

  const rememberJob = useCallback((job: Job) => {
    setHistory((prev) => {
      const rest = prev.filter((h) => h.id !== job.id);
      const next = [{ ...job }, ...rest].slice(0, HISTORY_MAX);
      writeHistoryLocal(next);
      return next;
    });
  }, []);

  const removeHistory = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.id !== id);
      writeHistoryLocal(next);
      return next;
    });
  }, []);

  function openHistoryEntry(entry: Job) {
    setError('');
    setJob(entry);
    setProfile(entry.profile);
    setPathId(entry.result?.paths[0]?.id || '');
    setFilter('all');
    setFocus('');
    setEditing(false);
    setShowHistory(false);
    setStep('explore');
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

  const prepareIntake = useCallback(
    async (question: string, seed: Partial<Profile> = {}) => {
      if (activeRequest.current) return;
      activeRequest.current = true;
      controller.current?.abort();
      const ac = new AbortController();
      controller.current = ac;
      setBusy(true);
      setError('');
      try {
        const plan = await request<IntakePlan>('/api/branches/intake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
          signal: ac.signal,
        });
        if (!plan.supported) {
          setError(plan.message);
          return;
        }
        setIntake(plan);
        setProfile({
          ...emptyProfile,
          ...seed,
          question: question.trim(),
          decisionScope: plan.scope,
          decisionPath: plan.path,
          decisionSector: plan.sector,
          conditionAnswers: {
            ...seed.conditionAnswers,
            ...Object.fromEntries(
              plan.fields
                .filter((field) => field.initialValue)
                .map((field) => [field.id, field.initialValue!]),
            ),
          },
        });
        setStep('conditions');
      } catch (e) {
        if (!ac.signal.aborted)
          setError(
            e instanceof Error
              ? e.message
              : '条件表单暂时未能生成，尚未开始知乎搜索。',
          );
      } finally {
        if (!ac.signal.aborted) setBusy(false);
        activeRequest.current = false;
      }
    },
    [],
  );

  async function changeDecisionPath(decisionPath: string) {
    if (busy || !profile.question) return;
    setBusy(true);
    setError('');
    try {
      const plan = await request<IntakePlan>('/api/branches/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: profile.question, decisionPath }),
      });
      const allowed = new Set(plan.fields.map((field) => field.id));
      const conditionAnswers = Object.fromEntries(
        Object.entries(profile.conditionAnswers).filter(([id]) =>
          allowed.has(id),
        ),
      );
      for (const field of plan.fields)
        if (!conditionAnswers[field.id] && field.initialValue)
          conditionAnswers[field.id] = field.initialValue;
      setIntake(plan);
      setProfile({
        ...profile,
        decisionScope: plan.scope,
        decisionPath: plan.path,
        decisionSector: plan.sector,
        conditionAnswers,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '选择类型暂时无法修改。');
    } finally {
      setBusy(false);
    }
  }

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
      setDynamicOpen(false);
      setProfile(nextProfile);
      setJob(null);
      setSavedRecordId('');
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
            if (current.status === 'done' && current.result?.questions.length)
              setDynamicOpen(true);
            if (current.error) setError(current.error);
            setPathId(current.result?.paths[0]?.id || '');
            // 探索成功即保存快照到浏览器本地，便于之后回看。
            if (current.status === 'done' && current.result)
              rememberJob(current);
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
    [rememberJob],
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
  const comparableRecords = records.filter(
    (record) =>
      record.question === profile.question && record.id !== savedRecordId,
  );
  const currentConditions = new Map([
    ['background', profile.background],
    ['time', profile.time],
    ['goal', profile.goal],
    ...Object.entries(profile.conditionAnswers || {}),
  ]);
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

  function returnHome() {
    controller.current?.abort();
    setStep('start');
    setProfile(emptyProfile);
    setStarterText('');
    setJob(null);
    setBusy(false);
    setError('');
    setEditing(false);
    setShowKeys(false);
    setShowHistory(false);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <GitBranch size={26} />
          <strong>
            <Link
              href="/"
              onClick={(event) => {
                event.preventDefault();
                returnHome();
              }}
            >
              人生分枝
            </Link>
          </strong>
          <span>基于知乎优质解答的经验探索工具</span>
        </div>
        <div className="header-right">
          <span className="source-label">
            <span className="live-dot" />
            知乎公开内容
          </span>
          {availability?.developerTools && (
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
          )}
          {history.length > 0 && (
            <button
              aria-haspopup="dialog"
              aria-expanded={showHistory}
              onClick={() => setShowHistory(true)}
              title="查看浏览器中保存的探索结果"
              className="key-toggle"
            >
              <Clock3 size={15} />
              我的结果（{history.length}）
            </button>
          )}
          {step === 'explore' && (
            <button
              disabled={busy}
              onClick={() => {
                setStep('start');
                setProfile(emptyProfile);
                setIntake(null);
                setJob(null);
                setSavedRecordId('');
                setError('');
              }}
            >
              <Plus size={16} />
              新的选择
            </button>
          )}
        </div>
        {availability?.developerTools && showKeys && (
          <section className="key-panel" aria-label="开发期临时密钥">
            <div className="key-panel-title">
              <strong>开发期临时密钥</strong>
              <span>仅保存在本服务进程内存，刷新 / 重启即清除</span>
            </div>
            <label className="key-field">
              <span>
                知乎 Access Secret{' '}
                {overrideStatus?.zhihu ? (
                  <em>（已注入 {overrideStatus.zhihu}）</em>
                ) : (
                  <em>（未注入 → 用本机默认）</em>
                )}
              </span>
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
                <button
                  disabled={keysSaving}
                  onClick={() => void saveTempKey('zhihu', zhihuKeyDraft)}
                >
                  {zhihuKeyDraft ? '注入该密钥' : '清除（用本机默认）'}
                </button>
              </div>
            </label>
            <label className="key-field">
              <span>
                搜索 / 分析 AI Key（DeepSeek 等）
                {overrideStatus?.ai ? (
                  <em>（已注入 {overrideStatus.ai}）</em>
                ) : (
                  <em>（未注入 → 用 .env.local / 环境变量）</em>
                )}
              </span>
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
                <button
                  disabled={keysSaving}
                  onClick={() => void saveTempKey('ai', aiKeyDraft)}
                >
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
            {step === 'start' ? '你想探索什么方向？' : '先了解一点你的情况'}
          </h1>
          {step === 'start' ? (
            <>
              <section className="intake-chat" aria-label="选择访谈">
                <div className="chat-turn assistant-turn">
                  <span className="chat-speaker">人生分枝</span>
                  <p>
                    说说你正在考虑的一个转专业或转行业选择。可以一起写下当前情况、目标、可投入时间和不能接受的代价。
                  </p>
                </div>
                <form
                  className="chat-composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (starterText.trim().length >= 2)
                      void prepareIntake(starterText.trim());
                  }}
                >
                  <label className="sr-only" htmlFor="starter-message">
                    描述你正在考虑的选择
                  </label>
                  <p className="meta" id="data-use-notice">
                    发送后，你的描述会交给 DeepSeek 生成条件表单。确认表单后，描述和部分条件会用于知乎检索，完整条件与检索片段会交给 DeepSeek 分析。
                  </p>
                  <textarea
                    id="starter-message"
                    aria-describedby="data-use-notice"
                    required
                    minLength={2}
                    maxLength={2000}
                    value={starterText}
                    placeholder="例如：我本科读市场营销，工作三年后想转行做产品经理。目前在职，每天能投入两小时，希望半年内完成转型。"
                    onChange={(e) => setStarterText(e.target.value)}
                  />
                  <div className="composer-footer">
                    <span>{starterText.length}/2000</span>
                    <button
                      className="primary"
                      disabled={busy || starterText.trim().length < 2}
                    >
                      {busy ? (
                        <>
                          <LoaderCircle className="spin" size={17} />
                          正在理解
                        </>
                      ) : (
                        <>
                          发送 <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
                <details className="quote-details">
                  <summary>数据保存范围 <ChevronDown size={13} /></summary>
                  <p className="meta">
                    完成的探索会自动保存在当前浏览器的快速历史，最多 20 条；点击“保存研究版本”会在本服务保存研究版本，最多 60 条，可分别从对应入口删除。{availability?.privateResearch ? '服务端版本按当前浏览器会话隔离，保留最多30天；清除会话后将无法找回。' : '开发环境的服务端研究记录尚未按访问者隔离。'}
                  </p>
                  <p className="meta">
                    新搜索缓存以查询摘要值检索返回片段，有效期24小时；旧缓存可能保留查询原文。用量日志只保存调用状态、来源数、模型、token 和错误类型，不保存你的问题原文；提交反馈时会单独保存问题概要。{availability?.privateResearch ? '本会话反馈保留最多30天，可单独删除。' : '开发环境反馈为共享记录。'}这些数据不会随研究版本删除，外部服务还会按各自的数据政策处理收到的内容。
                  </p>
                  {availability?.privateResearch && (
                    <>
                      <button className="secondary" type="button" disabled={busy} onClick={() => void removeSessionFeedback()}>
                        <Trash2 size={15} /> 删除本会话反馈
                      </button>
                      {feedbackDeletion && <output className="meta">{feedbackDeletion}</output>}
                    </>
                  )}
                </details>
              </section>
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
              {records.length > 0 && (
                <section className="research-records">
                  <div className="records-heading">
                    <History size={18} />
                    <h2>服务端研究版本</h2>
                    <span className="meta">{records.length}</span>
                  </div>
                  <p className="meta">保存在运行本网站的服务器，不是访问者的电脑。{availability?.privateResearch ? '按当前会话隔离，最多保留30天。' : '开发环境尚未按访问者隔离。'}删除不影响浏览器快速历史。</p>
                  {records.map((record) => (
                    <article key={record.id}>
                      <button
                        className="record-open"
                        type="button"
                        disabled={busy}
                        onClick={() => void openResearch(record.id)}
                      >
                        <span>
                          <strong>{record.question}</strong>
                          <small>
                            {new Date(record.savedAt).toLocaleString('zh-CN')} ·{' '}
                            {record.conditionCount} 项条件 · {record.pathCount}{' '}
                            条路径 · {record.caseCount} 段经历
                          </small>
                        </span>
                        <ArrowRight size={16} />
                      </button>
                      <button
                        className="icon-button record-delete"
                        type="button"
                        title="删除记录"
                        aria-label={`删除研究记录：${record.question}`}
                        onClick={() => void removeResearch(record.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </article>
                  ))}
                </section>
              )}
              <div className="example-section">
                <p className="muted">从一个具体选择开始</p>
                <div className="example-choices">
                  {exampleChoices.map((choice, i) => (
                    <button
                      key={choice}
                      onClick={() => {
                        setStarterText(choice);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      disabled={busy}
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
              <section className="intake-chat intake-review" aria-live="polite">
                <div className="chat-turn user-turn">
                  <span className="chat-speaker">你</span>
                  <p>{profile.question}</p>
                </div>
                <div className="chat-turn assistant-turn">
                  <span className="chat-speaker">人生分枝</span>
                  <p>
                    我已经把你明确说出的条件录入表单。请集中补充仍为空的基础条件，并检查自动填写是否准确。
                  </p>
                  {intake?.generatedBy === 'local-fallback' && (
                    <output className="intake-fallback">
                      <TriangleAlert size={16} />
                      DeepSeek 暂时不可用，当前表单由本地规则生成。你仍可继续，但自动识别的条件可能不完整，请重点检查并补充空项。
                    </output>
                  )}
                  {intake && (
                    <div className="intake-summary">
                      <span>
                        已识别{' '}
                        {
                          intake.fields.filter((field) => field.initialValue)
                            .length
                        }{' '}
                        项
                      </span>
                      <span>
                        待补充{' '}
                        {
                          intake.fields.filter((field) => !field.initialValue)
                            .length
                        }{' '}
                        项
                      </span>
                    </div>
                  )}
                </div>
                <form
                  className="intake-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void explore(profile);
                  }}
                >
                  <label className="field-label decision-path-field">
                    <span>
                      这次研究的选择类型
                      <small className="meta">
                        修改后会更新条件表和后续搜索计划，不会立即搜索或调用 DeepSeek
                      </small>
                    </span>
                    <select
                      value={profile.decisionPath}
                      disabled={busy}
                      onChange={(event) =>
                        void changeDecisionPath(event.target.value)
                      }
                    >
                      <option value="campus_transfer">校内转专业</option>
                      <option value="cross_major_graduate">跨专业读研</option>
                      <option value="minor">辅修</option>
                      <option value="second_bachelor">第二学士学位</option>
                      <option value="career_change">转行业 / 转岗</option>
                    </select>
                  </label>
                  {intake && (
                    <IntakeFields
                      plan={intake}
                      profile={profile}
                      onChange={setProfile}
                    />
                  )}
                  <div className="form-footer">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setStarterText(profile.question);
                        setStep('start');
                        setIntake(null);
                      }}
                    >
                      <ArrowLeft size={16} />
                      修改描述
                    </button>
                    <button className="primary">
                      <Search size={17} />
                      确认并搜索知乎
                    </button>
                  </div>
                </form>
              </section>
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
            {job?.status === 'done' && (
              <button
                title="保存服务端研究版本"
                disabled={Boolean(savedRecordId)}
                onClick={() => void saveResearch()}
              >
                {savedRecordId ? <Check size={16} /> : <Save size={16} />}
                {savedRecordId ? '版本已保存' : '保存研究版本'}
              </button>
            )}
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
                  <b>{q === FREE_NOTE_KEY ? '补充条件' : q}：</b>
                  {a}
                </span>
              ))}
              {Object.entries(profile.conditionAnswers || {}).map(
                ([id, answer]) => (
                  <span key={id}>
                    <Check size={13} />
                    <b>{dictionaryIndex.get(id)?.label || '其他条件'}：</b>
                    {answer}
                  </span>
                ),
              )}
            </div>
          </section>
          {job?.status === 'done' && comparableRecords.length > 0 && (
            <details className="version-comparison">
              <summary>
                <History size={16} />
                对比同一选择的其他条件版本 · {comparableRecords.length}
                <ChevronDown size={15} />
              </summary>
              {comparableRecords.map((record) => {
                const previous = new Map(
                  record.conditions.map((item) => [item.id, item.value]),
                );
                const ids = new Set([
                  ...currentConditions.keys(),
                  ...previous.keys(),
                ]);
                const changed = [...ids].filter(
                  (id) =>
                    (currentConditions.get(id) || '') !==
                    (previous.get(id) || ''),
                );
                return (
                  <article key={record.id}>
                    <div>
                      <strong>
                        {new Date(record.savedAt).toLocaleString('zh-CN')}
                      </strong>
                      <span className="meta">
                        {changed.length} 项条件不同 · {record.pathCount} 条路径
                        · {record.caseCount} 段经历
                      </span>
                    </div>
                    <button onClick={() => void openResearch(record.id)}>
                      打开此版本 <ArrowRight size={14} />
                    </button>
                  </article>
                );
              })}
            </details>
          )}
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
              {job?.result?.coverage && (
                <section aria-label="研究覆盖范围">
                  <h2>本次研究覆盖</h2>
                  <p>{job.result.coverage.sourceCount} 个来源 · {job.result.coverage.duplicateCount} 个重复来源 · {job.result.coverage.acceptedCount} 个入选案例 · {job.result.coverage.pathCount} 条行动路径</p>
                  {job.result.coverage.gaps.map((gap) => <p className="meta" key={gap}>{gap}</p>)}
                  <p className="meta">这些只是当前检索样本，未找到不代表不存在，数量不能用于推算成功率。</p>
                </section>
              )}
              {job?.profile.researchMode === 'general' && (
                <output className="error-banner">
                  <CircleHelp size={20} />
                  <div>
                    <strong>当前为通用经验研究</strong>
                    <p>
                      学校、现专业/岗位或目标专业/岗位等必需条件尚未补齐；本页不给出针对你的可行性或适配结论。
                    </p>
                  </div>
                </output>
              )}
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
                      {job?.result?.decisionClassification?.label || '这个选择'}
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
                              项正向阶段已核对
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
                        <br />
                        “正向阶段已核对”仅统计本次入选经历中有阶段引文的案例，每段计一次，不代表整条路径成功率。
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
                    {job?.result?.jobRequirementAssessment?.sampleCount ? (
                      <section className="job-requirements">
                        <div>
                          <h3>目标岗位要求校准</h3>
                          <span className="meta">
                            当前样本{' '}
                            {job.result.jobRequirementAssessment.sampleCount} 条{' '}
                            · 岗位：
                            {job.result.jobRequirementAssessment.role ||
                              '未提供'}
                            · 地区：
                            {job.result.jobRequirementAssessment.region ||
                              '未提供'}{' '}
                            · 日期：
                            {job.result.jobRequirementAssessment.publishedAt ||
                              '未提供'}
                          </span>
                        </div>
                        <dl>
                          {job.result.jobRequirementAssessment.requirements.map(
                            (item) => (
                              <div key={item.id}>
                                <dt>
                                  {item.label}
                                  <span
                                    className={`requirement-status ${item.status}`}
                                  >
                                    {item.status === 'met'
                                      ? '已满足'
                                      : item.status === 'gap'
                                        ? '有差距'
                                        : item.status === 'mixed'
                                          ? '部分满足'
                                          : '待对照'}
                                  </span>
                                </dt>
                                <dd>{item.value}</dd>
                                <dd className="meta">
                                  你的条件：
                                  {item.userValue || '未提供同口径信息'}
                                </dd>
                              </div>
                            ),
                          )}
                        </dl>
                        {job.result.jobRequirementAssessment.missing.length >
                          0 && (
                          <p className="meta">
                            还缺：
                            {job.result.jobRequirementAssessment.missing.join(
                              '、',
                            )}
                          </p>
                        )}
                      </section>
                    ) : null}
                    {path?.costAssessment && (
                      <section className="path-costs">
                        <h3>这条路径的成本与约束</h3>
                        {path.costAssessment.conflicts.map((item) => (
                          <p className="cost-conflict" key={item}>
                            <TriangleAlert size={15} /> {item}
                          </p>
                        ))}
                        <p>
                          <strong>已知：</strong>
                          {path.costAssessment.known.join('；') ||
                            '尚无可量化输入'}
                        </p>
                        <p>
                          <strong>还缺：</strong>
                          {path.costAssessment.missing.join('、') ||
                            '当前成本字段已填写'}
                        </p>
                      </section>
                    )}
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
                          {insights.filter((i) => i.type === type && i.semanticReviewVersion === 'ds-content-1').length ? (
                            insights
                              .filter((i) => i.type === type && i.semanticReviewVersion === 'ds-content-1')
                              .map((i, index) => (
                                <div className="insight" key={index}>
                                  <h4>{i.title}</h4>
                                  <p>{i.text}</p>
                                  <p className="meta">{i.verification === 'model-reviewed' ? 'AI 归纳，已作模型证据复核' : '原文片段，归纳尚未通过复核'}</p>
                                  <p className="insight-applicability">
                                    <strong>
                                      {i.type === 'practice'
                                        ? '参考条件与限制：'
                                        : '相关性与限制：'}
                                    </strong>
                                    {i.applicability}
                                  </p>
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
                              {type === 'practice' ? '当前证据不足以提炼具体做法。' : '暂未形成可靠风险归纳。'}
                            </p>
                          )}
                        </section>
                      ))}
                    </div>
                    <section className="cases-section">
                      <div className="cases-heading">
                        <h3>经验对照</h3>
                        <span className="meta">
                          以下为当前路径的样本数量，每段经历计一次，不能用于推算成功率。
                        </span>
                      </div>
                      <fieldset
                        className="result-filters"
                        aria-label="筛选当前路径样本，不代表成功率"
                      >
                        {[
                          ['all', '全部'],
                          ['success', '正向阶段已核对'],
                          ['setback', '受挫阶段已核对'],
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
                            <span aria-label="当前样本数">
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
                      <h2>回答新证据问题</h2>
                    </div>
                    <p className="meta">
                      针对当前来源逐项补充，只更新相关条件对照；不重新搜索，也不调用 DeepSeek。
                    </p>
                    {questions.length ? (
                      <button type="button" className="primary" onClick={() => setDynamicOpen(true)}>
                        补充 {questions.length} 项条件 <ArrowRight size={15} />
                      </button>
                    ) : (
                      <div className="no-questions">
                        <CheckCircle2 size={22} />
                        <p>目前没有新的关键补问。</p>
                        <span className="meta">
                          这不代表信息已完整。想修改初始化条件或补充其他情况，可使用下方「编辑全部条件」。
                        </span>
                      </div>
                    )}
                    <button
                      className="edit-conditions"
                      onClick={() => setEditing(true)}
                    >
                      <SlidersHorizontal size={16} />
                      编辑全部条件
                    </button>
                    <p className="meta">
                      用于修改初始化条件或自由补充；保存后复用现有来源并重新生成对照，不重新搜索，也不调用 DeepSeek。
                    </p>
                    <FeedbackCard
                      jobId={job?.id ?? null}
                      question={profile.question}
                    />
                    {!!job?.conditionHistory?.length && (
                      <details className="quote-details">
                        <summary>条件修改记录 <ChevronDown size={13} /></summary>
                        {job.conditionHistory.map((version) => (
                          <section key={version.version}>
                            <h3>第 {version.version} 版 · {version.kind === 'legacy' ? '历史基线' : version.kind === 'initial' ? '初始化' : '条件更新'}</h3>
                            <p className="meta">{new Date(version.at).toLocaleString()}</p>
                            {version.changes.map((change) => (
                              <p key={change.id}>
                                {change.label}：{change.before || '未填写'} → {change.after || '已清空'}
                                <span className="meta">（{{ initial: '初始化提供', basic: '基础补问', evidence: '经历触发', edit: '主动修改' }[change.origin]}）</span>
                              </p>
                            ))}
                          </section>
                        ))}
                      </details>
                    )}
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
              {job?.status === 'done' &&
                profile.decisionScope === 'major_transition' && (
                <section className="official-sources-section">
                  <div className="official-heading">
                    <ShieldCheck size={18} />
                    <div>
                      <h2>学校或政府官方材料</h2>
                      <p className="meta">
                        资格判断的独立前置层，不由知乎个人经验替代。
                      </p>
                    </div>
                  </div>
                  <div className="official-check missing">
                    <div>
                      <strong>官方资格依据</strong>
                      <span
                        className={`check-status ${job.officialAssessment?.eligibilityStatus === 'official_rules_found' ? 'confirmed' : 'unknown'}`}
                      >
                        {job.officialAssessment?.eligibilityStatus ===
                        'official_rules_found'
                          ? '已找到官方规则'
                          : '资格未知'}
                      </span>
                    </div>
                    <p>
                      {job.officialAssessment?.eligibilityMessage ||
                        '未找到可核对的目标学校官方规则。'}
                    </p>
                  </div>
                  {job?.officialSources?.map((source) => (
                    <article key={source.id}>
                      <div>
                        <h3>{source.title}</h3>
                        <a
                          className="source-link"
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          官方原文 <ArrowUpRight size={14} />
                        </a>
                      </div>
                      <p className="meta">
                        {source.host} · 页面年份：
                        {source.years.length
                          ? source.years.join('、')
                          : '未识别'}{' '}
                        · 材料类型：
                        {source.documentTypes?.length
                          ? source.documentTypes.join('、')
                          : '待确认'}{' '}
                        · 读取于{' '}
                        {new Date(source.retrievedAt).toLocaleString('zh-CN')}
                      </p>
                      <p>{source.excerpt}</p>
                    </article>
                  ))}
                  {job?.officialAssessment && (
                    <div className="official-assessment">
                      {(['eligibility', 'cost'] as const).map((group) => (
                        <section key={group}>
                          <h3>
                            {group === 'eligibility'
                              ? '申请可行性核对'
                              : '课程与毕业成本'}
                          </h3>
                          {job
                            .officialAssessment!.checks.filter(
                              (item) => item.group === group,
                            )
                            .map((item) => (
                              <div className="official-check" key={item.id}>
                                <div>
                                  <strong>{item.label}</strong>
                                  <span
                                    className={`check-status ${item.status}`}
                                  >
                                    {item.status === 'satisfied'
                                      ? '已满足'
                                      : item.status === 'not_satisfied'
                                        ? '未满足'
                                        : item.status === 'conflict'
                                          ? '信息冲突'
                                          : item.status === 'confirmed'
                                            ? '官方已说明'
                                            : '待核实'}
                                  </span>
                                </div>
                                <p>官方信息：{item.officialValue}</p>
                                <p className="meta">
                                  政策年份：
                                  {item.policyYears?.length
                                    ? item.policyYears.join('、')
                                    : '未识别'}
                                  {' · '}本次核对年份：
                                  {item.applicableYear || '未设定'}
                                  {item.policyStatus === 'expired'
                                    ? ' · 材料已过期，不支持当前资格判断'
                                    : item.policyStatus === 'unknown'
                                      ? ' · 年份不明，仅作参考'
                                      : item.policyStatus === 'different_year'
                                        ? ' · 与本次核对年份不同'
                                        : ''}
                                </p>
                                {item.userValue && (
                                  <p>你的条件：{item.userValue}</p>
                                )}
                                <details className="quote-details">
                                  <summary>
                                    官方原文依据 <ChevronDown size={13} />
                                  </summary>
                                  <blockquote>{item.quote}</blockquote>
                                </details>
                              </div>
                            ))}
                          {group === 'cost' &&
                            !job.officialAssessment!.estimates?.length && (
                              <p className="meta">
                                当前没有足够输入生成成本估算，以下仅区分官方事实与待核实项。
                              </p>
                            )}
                          {job
                            .officialAssessment!.missing.filter(
                              (item) => item.group === group,
                            )
                            .map((item) => (
                              <div
                                className="official-check missing"
                                key={item.id}
                              >
                                <strong>{item.label}</strong>
                                <span className="check-status unknown">
                                  官方页面未识别
                                </span>
                              </div>
                            ))}
                        </section>
                      ))}
                    </div>
                  )}
                </section>
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
                    {job?.result?.sourceDispositions && (
                      <p className="meta">详细案例采用 {job.result.sourceDispositions.filter((item) => item.accepted).length} 个来源；
                        未采用 {job.result.sourceDispositions.filter((item) => !item.accepted).length} 个来源。未采用不等于无价值。
                      </p>
                    )}
                    {job?.sources.map((s) => (
                      <article key={s.id}>
                        <div>
                          <h3>{s.title}</h3>
                          <SourceLink source={s} />
                        </div>
                        <p className="meta">{job?.result?.sourceDispositions?.find((item) => item.sourceId === s.id)?.reason || '来源去向未记录'}</p>
                        <p className="meta">
                          仅摘要 ·{' '}
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
              {!!job?.metrics?.stages.some((stage) => stage.stage === 'query_result') && (
                <details className="sources-section">
                  <summary>本次查询记录 <ChevronDown size={16} /></summary>
                  {job.metrics.stages.filter((stage) => stage.stage === 'search_stop').map((stage, index) => (
                    <p className="meta" key={`stop-${index}`}>{String(stage.reason)}</p>
                  ))}
                  {job.metrics.stages.filter((stage) => stage.stage === 'query_result').map((stage, index) => (
                    <section key={index}>
                      <h3>第 {String(stage.round)} 轮 · {String(stage.purpose)}</h3>
                      <p>{String(stage.query)}</p>
                      <p className="meta">返回 {String(stage.returnedCount)} 条，累计去重后 {String(stage.sourceCount)} 个来源。</p>
                    </section>
                  ))}
                </details>
              )}
              <footer className="workspace-footer">
                <ShieldCheck size={15} />
                <span>依据搜索片段整理 · 非完整原文 · 不代表成功率</span>
                {Boolean(job?.result?.rejected) && (
                  <span>已移除 {job?.result?.rejected} 项无有效引用的分析</span>
                )}
                <button
                  type="button"
                  className="admin-entry"
                  onClick={() => {
                    window.location.href = '/admin';
                  }}
                >
                  数据后台
                </button>
              </footer>
            </>
          )}
        </main>
      )}
      {editing && (
        <ProfileDialog
          profile={profile}
          intake={intake}
          onClose={() => setEditing(false)}
          onSave={(p) =>
            void explore(p, job?.sources.length ? job.id : undefined)
          }
          showFreeNote={questions.length === 0}
        />
      )}
      {job?.status === 'done' && questions.length > 0 && (
        <DynamicConditionDialog open={dynamicOpen} onClose={() => setDynamicOpen(false)}>
          <DynamicConditionForm key={job.id} questions={questions}
            onSource={(sourceId) => {
              setDynamicOpen(false);
              const item = paths.flatMap((p) => p.cases).find((c) => c.sourceId === sourceId);
              if (item) jump(item.id);
            }}
            onSubmit={(answers, skipped) => {
              const conditionAnswers = { ...profile.conditionAnswers };
              for (const question of questions) {
                const answer = answers[question.question]?.trim();
                if (answer && question.conditionId) conditionAnswers[question.conditionId] = answer;
              }
              void explore({ ...profile, conditionAnswers,
                answers: { ...profile.answers, ...answers },
                skipped: [...new Set([...profile.skipped, ...skipped])],
              }, job.id);
            }}
          />
        </DynamicConditionDialog>
      )}
      {showHistory && (
        <HistoryDialog
          history={history}
          onOpen={openHistoryEntry}
          onDelete={removeHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
