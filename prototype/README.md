# 人生分枝：本地原型

一次研究一个人生选择，按行动路径导航，对照条件、行动和阶段结果。

## 运行

需要 Node.js 22.13+，以及已安装、已配置凭证的知乎 CLI。

```sh
npm install
npm start
```

默认访问 http://localhost:4317 。若该端口已占用，使用 `npm run dev -- --host 127.0.0.1 --port 4318`。

应用使用当前机器的系统安全凭证库，不需要把密钥复制到代码或前端。CLI 会按平台自动探测官方默认安装位置（Windows：`%LOCALAPPDATA%\ZhihuCLI\current\zhihu-cli.exe`；macOS：`~/Library/Application Support/zhihu-cli/current/zhihu-cli`）；非默认路径可通过 `ZHIHU_CLI_PATH` 指定二进制绝对路径，或设置 `ZHIHU_CLI_HOME` 指向安装根目录。

**Windows 提示**：若 PowerShell 执行策略阻止 `npm`，请改用 `npm.cmd` 执行所有命令。

## 数据与分析

- 实时模式：两组知乎搜索，分析服务可选择知乎直答或 DeepSeek，引用需通过连续原文匹配检查。
- 动态补问与条件修改：复用上一轮来源重新分析。界面明确显示失败，提交未被接受时保留原先结果与对应条件。
- 历史样本：2026-09-05 已取得的真实知乎片段，虚构示例人物，手工整理的原型标注；明确区别于实时模型输出。
- 搜索返回摘要，不保证完整或真实；引用存在不等于语义推论正确，结果仍需人工评估。
- 缓存：搜索结果先查进程内内存（1 小时、最多 40 条）与磁盘 `.local/search-cache.jsonl`（24 小时、自动压容量），都未命中才真正调用知乎 CLI，成功后写回两层缓存。因此同一查询在不同的会话、进程乃至服务重启后都能复用，减少知乎搜索额度消耗。缓存 key 为“探索问题 + 背景前 60 字 + 正反短语”的完整字符串，语义同义不同写法的查询暂不会命中。
- 探索记录只存服务端进程内，一小时后过期、重启即清空；但**成功的探索会自动把结果快照存到浏览器 `localStorage`**（键 `lb-browser-history-v1`，最多 20 条），顶栏「我的结果」可回看与删除，与服务端是否重启无关。历史片段本身也在本地源文件中。
- 本地开发中间件提供 API，生产 Worker 构建不包含本机 CLI 能力。当前交付是本地原型，不能直接当作完整线上部署包。

## 本地 DeepSeek 配置

在本机 `prototype/.env.local` 设置 `ANALYSIS_PROVIDER=deepseek`、`DEEPSEEK_MODEL=deepseek-v4-flash` 和 `DEEPSEEK_API_KEY`。该文件被 Git 忽略，应限制为仅当前用户读写。不要使用 `VITE_` 或 `NEXT_PUBLIC_` 前缀存放密钥。

默认不配置时继续使用知乎直答；显式配置 `ANALYSIS_PROVIDER=zhihu` 可切回。服务不会在失败时自动切换供应商或重试收费调用。配置修改后须重启本地服务。

DeepSeek 模式只检查所需的知乎搜索额度，复用来源重新分析不依赖知乎直答额度。请求固定发往官方 API，90 秒截止、最多 6000 输出 tokens；拒绝空内容、非 JSON、截断结果和无效引用。合法 JSON 与有效引用都不等于语义准确。

`node server/verify-deepseek.mjs` 使用既有公开片段和虚构用户做三次分析，不消耗知乎搜索额度，但会产生 DeepSeek 费用。结果只写入忽略的 `.local/deepseek-verification`。默认离线测试不调用外部模型。历史演示不会被测试结果自动替换。

## 验证

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
```

`server/live-check.mjs` 是需要真实知乎额度的端到端验证脚本，使用明确标注的虚构人物。它不属于默认测试，额度不足时不要循环执行。

2026-09-06 已通过真实后端全链路验证：两组搜索取得 9 条去重来源，生成分析后修改虚构人物条件，复用全部来源完成重新分析。独立运行方式为 `node server/run-live-verification.mjs`，会消耗两次搜索、两次直答，不属于默认测试。

内容质量验收未通过：仍存在引文不支持结论、行动路径错误归类、正反案例覆盖不足等问题。引用匹配校验并不验证语义，测试脚本的 PASS 仅表示流程成功。此次测试后搜索剩余 8 次、直答剩余 0 次，额度以后续实查为准。尚未做浏览器截图与移动端实机验收，也未验证 WebMCP 浏览器支持。

## 管理后台与用户反馈

- 结果页右栏提供 1–5 星评分与可选评论；数据写入 `.local/feedback.jsonl`。
- 每次探索（含失败）记一条用量：次数、来源数、provider/模型、token 用量与问题概要，写入 `.local/usage.jsonl`。
- 管理页面位于 `/admin`：概览指标、token 汇总、知乎实时额度、反馈列表与最近使用记录。管理密码读取 `ADMIN_PASSWORD`，未设置时回退默认值 `life-branches-dev`（仅限本地开发，正式使用必须显式设置）。
- 顶栏「开发者密钥」面板可在开发期临时注入知乎 Access Secret 与分析 AI Key，仅存服务进程内存，刷新 / 重启即失效；未注入时行为与默认配置完全一致。
- 存储实现见 `server/storage.mjs`；上云时替换为同接口的 KV/数据库实现，数据文件与密钥不进入仓库（`.local/`、`.env*` 均已忽略）。
