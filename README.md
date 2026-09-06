# 人生分枝

一次研究一个人生选择，按行动路径浏览知乎经验，对照值得参考的做法、相关风险和仍需确认的条件。

当前是开发中的本地原型，聚焦转行、学习与专业选择、出国。真实后端搜索与重新分析流程已验证；语义判断质量尚未通过验收，不应作为人生决策结论。

## 功能一览

- **条件表单**：首页多字段表单（年龄 / 学历 / 城市 / 当前专业 / 材料 / 想走方向），第二步补充投入时间与限制，一键开始探索。
- **行动路径结果页**：路径导航、经验详情、逐条原文引用、正反对照、动态补问、条件修改后复用来源重新分析。
- **历史样本**：无需知乎凭证即可体验的固定样本。
- **用户反馈**：结果页右栏 1–5 星评分 + 可选评论，提交后由管理员在数据后台查看。
- **开发者密钥面板**：顶栏「开发者密钥」，开发期可临时注入知乎 Access Secret 或分析 AI Key（DeepSeek），用于轮换账号/额度受限时调试；仅存进程内存，刷新 / 重启即清除，不影响本机 keychain 与 `.env.local`。
- **数据后台 `/admin`**：查看用户反馈（均分/分布/明细）、使用次数、token 用量、知乎实时额度与最近使用记录。

## 本地运行

需要 Node.js 22.13 或更新版本。

```sh
cd prototype
npm ci
npm start
```

打开 http://localhost:4317 。历史样本不需要知乎凭证；实时搜索需要自行安装知乎官方 CLI 并配置个人凭证（项目不会附带共享密钥）。

**Windows 提示**：若 PowerShell 执行策略阻止 `npm`，请用 `npm.cmd`。zhihu-cli 会自动探测 Windows（`%LOCALAPPDATA%\ZhihuCLI\current\zhihu-cli.exe`）与 macOS（`~/Library/Application Support/zhihu-cli/current/zhihu-cli`）的官方默认位置；非默认安装可显式指定：

| 环境变量 | 作用 |
|---|---|
| `ZHIHU_CLI_PATH` | zhihu-cli 二进制绝对路径（最高优先级） |
| `ZHIHU_CLI_HOME` | zhihu-cli 安装根目录（自动补 `current/zhihu-cli[.exe]`） |
| `ANALYSIS_PROVIDER` | `zhihu`（默认，走知乎直答）或 `deepseek` |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` | DeepSeek 凭证与模型（默认 `deepseek-v4-flash`） |
| `ADMIN_PASSWORD` | 数据后台密码。**未设置时回退默认值 `life-branches-dev`（仅限本地开发）** |
| `PORT` | 备用（vinext 默认 4317） |

找不到 CLI 时后端会返回带路径与设置指引的中文错误，而不是裸 `ENOENT`。

## 数据后台

1. 运行服务后访问 http://localhost:4317/admin （结果页 footer 也有低调入口）。
2. 输入管理密码（默认 `life-branches-dev`，正式使用请设置 `ADMIN_PASSWORD`）。
3. 查看：概览指标、token 汇总、知乎实时额度、反馈列表、最近使用记录。

用户反馈与用量记录落盘于 `prototype/.local/feedback.jsonl` 与 `usage.jsonl`（已 Git 忽略）。记录包含本次探索的问题概要（前 120 字），不包含原始回答正文；探索次数按"一次完成的探索"计，token 用量来自分析服务返回的 usage。

## 项目结构

- `prototype/app`：页面、条件表单、路径导航、经验详情、反馈卡（`workspace.tsx`）；数据后台（`app/admin/page.tsx`）。
- `prototype/server`：搜索与 CLI 路径解析（`engine.mjs`）、分析服务（`deepseek.mjs`）、API 中间件（`api.mjs`）、反馈与用量存储（`storage.mjs`）、引用校验与测试。
- `prototype/lib`：共享类型。
- [开发规格](原型开发规格.md)：已确认的产品范围。
- [验证与已知问题](原型交付记录.md)：当前交付状态。
- [协作约定](CONTRIBUTING.md)：分支、检查和数据安全。

## 检查

在 `prototype` 目录运行：

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
```

默认测试不消耗知乎额度。真实调用测试须手动运行，会使用执行者的额度。`.local`、`.env*`、凭证、缓存与构建产物不提交。

## 上云 / 部署注意

- 生产构建不包含本机 CLI 后端；云端检索需替换为 HTTP 直连或服务端适配（凭证只放服务端）。
- **必须设置强 `ADMIN_PASSWORD`**，否则后台使用默认密码。
- `storage.mjs` 当前是本地 JSONL 实现；上云时替换为同一接口的 KV/数据库实现即可，调用方无需改动。
- 不要把 `.local/`、`.env*`、真实用户画像或密钥提交到仓库。

## 当前重点

- 避免将完成项目误判为成功入行。
- 不根据专业或身份推断未被明确说明的条件。
- 保留正反经验与相关风险，验证路径导航稳定性。
- 补充桌面和移动端交互验收。

仓库暂未选择开源许可证；分享源码不代表授予对外再分发许可。知乎引用内容的权利仍属于原权利人。
