# 人生分枝：本地原型

一次研究一个人生选择，按行动路径导航，对照条件、行动和阶段结果。

## 运行

需要 Node.js 22.13+，以及已安装、已配置凭证的知乎 CLI。

```sh
npm install
npm start
```

默认访问 http://localhost:4317 。若该端口已占用，使用 `npm run dev -- --host 127.0.0.1 --port 4318`。

`start` / `dev` / `build` / `test` 会先执行 `npm run check-deps`，核对 `node_modules` 是否与 `package.json`、`package-lock.json` 一致。若启动时出现 `ERR_MODULE_NOT_FOUND`（例如 `Cannot find package 'cheerio'`），说明安装树是旧的或不完整的——常见于直接解压了在依赖变更之前打包的 `node_modules`（`node_modules` 不受 Git 管理，不要跨机器复制）。在 `prototype` 目录重新执行 `npm install` 即可恢复；`npm run check-deps` 可随时手动自检。

应用使用当前机器的系统安全凭证库，不需要把密钥复制到代码或前端。CLI 会按平台自动探测官方默认安装位置（Windows：`%LOCALAPPDATA%\ZhihuCLI\current\zhihu-cli.exe`；macOS：`~/Library/Application Support/zhihu-cli/current/zhihu-cli`）；非默认路径可通过 `ZHIHU_CLI_PATH` 指定二进制绝对路径，或设置 `ZHIHU_CLI_HOME` 指向安装根目录。

**生产 / 云端运行**：设置 `ZHIHU_ACCESS_SECRET` 后，知乎检索会走官方 HTTP API 直连（`server/zhihu-http.mjs`），不再需要本机 zhihu-cli，适合云端或无 CLI 环境。生产形态可先 `npm run build`，再 `PORT=8080 node standalone-server.mjs` 在同一端口提供页面与 `/api/branches/*`（详见仓库根 README「生产运行」）。

**Windows 提示**：若 PowerShell 执行策略阻止 `npm`，请改用 `npm.cmd` 执行所有命令。

## 数据与分析

- [网站问题汇总与整改计划](./WEBSITE-REMEDIATION-PLAN.md)
- [产品问题与解决进度](./PRODUCT-BACKLOG.md)
- [算法与接口整改进度](./ALGORITHM-STATUS.md)
- [转专业 / 转行条件词典](./CONDITION-DICTIONARY.md)

- 搜索前访谈：首页先接收一段自然描述，DeepSeek 只从条件词典选择字段并提取带连续用户原句的值；第二回合自动预填可核对的条件，并集中追问缺失项。用户确认初始化表单后才开始知乎搜索。
- 实时模式：最多五组知乎搜索，受知乎 CLI 的 `--count` 上限限制，每组最多 10 条。五轮依次覆盖硬条件与路径、自适应补缺、明确结果、关键约束和回顾复盘；最多保留 50 个去重来源，全部以压缩摘要形式交给 DeepSeek。模型最多整理 8 个证据较完整的详细案例，其余材料仍保留在来源列表。引用、阶段、条件差异和路径由本地规则复核。
- 动态补问与条件修改：复用上一轮来源和已接受案例，只在本地重算对照、问题、路径成本和岗位要求，不重复调用知乎或 DeepSeek。
- 官方材料：转专业可提供 `.edu.cn` / `.gov.cn` HTTPS 链接，网页、PDF、Word 和受限同站附件与知乎经验分层展示。
- 历史样本：2026-09-05 已取得的真实知乎片段，虚构示例人物，手工整理的原型标注；明确区别于实时模型输出。
- 搜索返回摘要，不保证完整或真实；引用存在不等于语义推论正确，结果仍需人工评估。
- 未保存的运行中任务一小时后过期。用户主动保存的研究版本持久化在 Git 忽略的 `.local/`，可重开、比较和删除；上限 60 条且总大小不超过 8MB。
- 运行指标只记录阶段、调用、耗时、模型/规则版本、拒绝原因和引用通过率，不记录密钥或用户问题。
- 缓存：先查进程内内存与 `.local/search-cache.sqlite`（24 小时），未命中再兼容读取旧 `.local/search-cache.jsonl`，最后才调用知乎。新缓存以查询摘要值为键，仅保留来源字段，最多1000条/64MiB，访问时清理过期数据；旧文件不再追加且不会自动删除，仍可能保留历史查询词。摘要键不等于匿名化，缓存文件仍须保护，不得提交到 GitHub。CLI 与 HTTP 直连共用缓存和五轮策略。
- 成功探索也会自动保存到浏览器 `localStorage`（最多 20 条），用于当前浏览器快速回看；服务端研究档案用于持久保存、条件版本比较和重新匹配，两者互不替代。
- 本地开发中间件提供 API，生产 Worker 构建不包含本机 CLI 能力。当前交付是本地原型，不能直接当作完整线上部署包。

## 本地 DeepSeek 配置

在本机 `prototype/.env.local` 设置 `DEEPSEEK_API_KEY`(必需)与 `DEEPSEEK_MODEL`(可选,默认 `deepseek-v4-flash`)。该文件被 Git 忽略,应限制为仅当前用户读写。不要使用 `VITE_` 或 `NEXT_PUBLIC_` 前缀存放密钥。

分析已统一由 DeepSeek 完成,**知乎直答已弃用**——无需再配置 `ANALYSIS_PROVIDER`,知乎仅用于真实经历检索。服务不会在失败时自动切换供应商或重试收费调用。配置修改后须重启本地服务。

分析只检查所需的知乎搜索额度,复用来源重新分析不依赖知乎额度。请求固定发往 DeepSeek 官方 API,单次90秒截止；案例抽取最多12000输出tokens，审核默认6000。拒绝空内容、非JSON、截断结果和无效引用。合法JSON与有效引用都不等于语义准确。

案例召回：逐来源给出模型筛选理由，详细案例合计最多8个，不限制每条路径最多2个；引用使用明确标注的片段编号，由服务端取回原文。行动总结未通过审核的内容不计作入选经历。非重复来源至少8个且审核后仅剩0–1例时，复用未入选来源进行一次聚焦补查及审核，不新增知乎搜索；含搜索中途检查点最多5次模型调用，不无限补查。规则版本为`evidence-5-case-recall`，旧页面结果需要“复用来源重新分析”才能应用新规则。

检索拆分（2026-09-10）：首轮只组合所选路径与专业/岗位转换方向，不将学校、行业、绩点和个人时间一并作为约束。目标专业/岗位、学校条件或行业招聘、准备成本、适应回顾分别检索，最多5轮且单轮最多10条。首轮不足3个非重复来源时去掉起点条件；目标专业/岗位相关片段占比不足40%时采用目标主题查询，不以学校名称出现代替专业相关。关键词命中仅用于调整查询，不代表语义相关性或事实可靠性。学校查询返回的知乎材料不是官方资格依据。新查询会使用新缓存键；旧研究必须重新搜索，单击“复用来源重新分析”不会更新来源集合。

`node server/verify-deepseek.mjs` 使用既有公开片段和虚构用户做三次分析，不消耗知乎搜索额度，但会产生 DeepSeek 费用。结果只写入忽略的 `.local/deepseek-verification`。默认离线测试不调用外部模型。历史演示不会被测试结果自动替换。

## 验证

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
```

`server/live-check.mjs` 是需要真实知乎额度的端到端验证脚本，使用明确标注的虚构人物。它不属于默认测试，额度不足时不要循环执行。

2026-09-07 已用当前版本完成两组真实验收：转行任务取得 9 个来源、5 段入选经历，并汇总 2 条目标岗位要求；校内转专业任务取得 10 个来源、4 段入选经历，识别 1 个“转专业获批”阶段，并读取真实官方通知及 Word 附件。条件变更只做本地重算，3 个已接受案例保持不变，搜索与模型调用均为 0。

全套 104 项自动测试与 40 题评测集通过；依赖安全扫描为 0 个已知问题。引用连续性与本地语义规则能降低错误，但不能证明个人自述真实，也不能把当前样本频次解读为成功率。浏览器自动化服务本轮不可用，未新增视觉截图验收。2026-09-08 实查“理科转文科”五轮检索得到 37 个去重来源，DeepSeek 使用全部来源并输出 8 个详细案例；知乎当日剩余 4995 次。

## 管理后台与用户反馈

- 结果页右栏提供 1–5 星评分与可选评论；开发环境写入 `.local/feedback.jsonl`，生产环境写入会话隔离数据库，保留30天/每会话100条。首页“数据保存范围”可删除当前会话反馈，不删除研究版本或匿名用量。旧开发反馈不自动迁移。
- 每次探索（含失败）记一条用量：次数、来源数、provider/模型、token 用量与错误类型，写入 `.local/usage.jsonl`；不记录用户问题原文。
- 管理页面位于 `/admin`：概览指标、token 汇总、知乎实时额度、反馈列表与最近使用记录。管理密码读取 `ADMIN_PASSWORD`；仅开发环境未设置时回退 `life-branches-dev`，生产环境未设置则关闭管理接口。
- 顶栏「开发者密钥」面板只在非生产环境且通过本机回环地址访问时开放，可临时注入知乎 Access Secret 与分析 AI Key；公网主机名访问时入口和接口均关闭。密钥仅存服务进程内存，刷新 / 重启即失效。
- 存储实现见 `server/storage.mjs`；上云时替换为同接口的 KV/数据库实现，数据文件与密钥不进入仓库（`.local/`、`.env*` 均已忽略）。
# Production Call Budget

Production research versions use `.local/private-research.sqlite`, separate from
development JSON records. A Secure, HttpOnly, SameSite=Strict anonymous browser
cookie scopes listing, reading, deletion and job reuse. Serve production over
HTTPS. Clearing this cookie loses access; this is not a registered account or
cross-device identity. Research versions expire after 30 days (purged on storage
access), with at most 60 versions and 8 MiB per session. Existing development
records are not automatically imported. Use one persistent local database volume;
independent hosts need a shared database service before horizontal deployment.
Deletion covers that research version, not browser history, shared search cache,
feedback or operational logs. Offsite backup and restoration procedures remain a
deployment requirement; no backup is uploaded by this code.

### Private Research Backup

The server-only store exposes `backup(destination)` using SQLite `VACUUM INTO`
for a consistent snapshot. The destination must not exist; it is created with
owner-only permissions. Expired versions are removed before the snapshot.
From this directory:

```sh
node --input-type=module -e 'import {createPrivateResearchStore} from "./server/private-research-store.mjs"; const store=createPrivateResearchStore(); try { await store.backup(".local/backups/research-"+Date.now()+".sqlite"); } finally { store.close(); }'
```

For recovery, stop all production processes, preserve the existing database,
and restore the snapshot as `.local/private-research.sqlite` with mode `600`
before restarting. Existing session cookies are required to access the same
records. Tests verify restoration, isolation, expiry and the 60-version ceiling
using synthetic data. Snapshots contain private content: never commit them;
restrict backup access and retention. Restoring an old snapshot can resurrect
deleted records; reconcile deletion requests before serving it. This does not
back up budgets, search cache or logs. Production feedback shares this snapshot
and its deletion-restoration caveat. No offsite schedule is configured.

Production API requests (`NODE_ENV=production`) reserve worst-case calls before
running: initial intake reserves one model call; new research reserves five
search calls and three model calls; local rematching reserves no external calls.
After round three, personalized research with at least four independent sources
may perform an extraction-only checkpoint. Early stopping requires at least four
validated cases across two action branches, positive and setback stage evidence,
and at least one comparable condition per case. This is a sample coverage target,
not proof of exhaustive evidence or certainty. If coverage is insufficient,
search continues up to five rounds. Unchanged sources reuse the checkpoint;
changed sources get a final extraction. One summary review follows, giving a
maximum of three model calls (checkpoint, final extraction, review), no retries.
The daily UTC ceiling is 50 search calls and 100 model calls, with per-connection
ceilings of 10 searches and 20 model calls and six requests per minute.
Reservations are conservative and are not refunded after failure or cache hits.
The ledger uses Node's built-in SQLite in `.local/budget.sqlite`, requiring the
declared Node runtime and a persistent writable local volume. Processes sharing
that file share its transactional limit; independent hosts do not share a budget.
Client identity uses the socket address, not untrusted forwarded headers. Behind
a reverse proxy, users may consequently share the connection-level limit.
Development remains unrestricted by this gate. Do not publish the database.

### Browser Regression Checks

Run `npx playwright install chromium` once, then `npm run test:browser`.
The test runner starts a local server on port 4320. When a development server is
already running, use `E2E_BASE_URL=http://127.0.0.1:4318 npm run test:browser`.
Tests intercept API requests with synthetic fixtures and consume no Zhihu or
DeepSeek quota. They cover initial intake, confirmation before research,
results, multi-question dialog, draft retention and batch rematching at desktop
and two mobile sizes. Screenshots stay in ignored `.local/browser-test-results`.
These controlled checks do not replace real-service or cross-browser acceptance.

The `miniflare` transitive `sharp` dependency is overridden to `0.35.4` to
address GHSA-rgj7-g3m4-5g8c without downgrading the Cloudflare toolchain.
Revisit this override when upstream updates its pinned dependency.

Analysis selects up to four contiguous windows of at most 600 characters per
source from already returned text, retaining the opening and preferring action
and outcome paragraphs. Windows are ordered, not concatenated into a quote.
This does not fetch full articles or guarantee complete context.

### DS Content Generation

New analyses use DeepSeek for both candidate summaries and independent content
classification/evidence review. Actual actions are no longer admitted by a local
action-keyword requirement in final analysis. The reviewer must explicitly return
the expected content type as well as support: goals, feelings and general advice
cannot qualify as actual actions or practices. Citation, numeric support, stage,
direction and structured-condition safeguards remain in place. The conservative
search checkpoint is unchanged and does not publish content as reviewed.

Only summaries marked `model-reviewed` and `ds-content-1` appear as conclusions.
Unapproved facts retain their original quotation in collapsed evidence; they do
not fall back to displaying that quote as a summary. Unreviewed practices/risks
are omitted from conclusion panels, including during local rematching. Legacy
records without this review marker are not upgraded automatically: start a new
research run to generate the new summaries. This avoids silently charging for
opening history. Local rematching remains zero external calls. The rule version
is `evidence-4-ds-content`; model review is not verification of real-world truth.

## Local Diagnostic Snapshot

The bottom-right camera button saves UI metadata to `.local/diagnostics/latest.json`
relative to the prototype server working directory. It also works inside dialogs.
Each click replaces the previous snapshot. Metadata includes research and saved
record IDs, selected branch, result filter, focused/visible cases, expanded evidence,
open dialogs, viewport and scroll offsets. It does not include form text, source
content, cookies, browser storage or credentials. This is a locator, not a research
backup or automatic replay. Reopening expired jobs still requires saved research.

The endpoint is disabled in production and rejects non-local hosts and cross-site
requests. Files are owner-readable/writable only; `.local/` is Git-ignored. No
external API is called and no snapshot is uploaded to GitHub. To debug, click the
camera on the relevant view, then ask the assistant to read the latest local snapshot.
# 路径证据输出（2026-09-10 本地更新）

新研究使用 `evidence-6-path-evidence`：DS 先从来源中生成 `evidencePaths`，按行动、建议、条件、成本、结果、政策转述、统计分类。不要求每个来源构成完整案例；归纳通过片段引用校验和独立模型复核后才展示，个人经历保留为辅助详情。

旧研究需点击“复用来源重新分析”才能采用新结构，不自动消耗额度。主分析格式失败最多修复一次；最大分析预算为7次，计入检索检查点、路径审核、低召回补查与格式修复。失败保留已有经历与原始来源；不将未经审核的摘抄回填为总结。政策需另行官方核实，模型复核不保证事实真实或路径分类完全正确。
