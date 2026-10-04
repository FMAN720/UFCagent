# UFCagent · OCTAGON UFC 智能助手

[![CI](https://github.com/FMAN720/UFCagent/actions/workflows/ci.yml/badge.svg)](https://github.com/FMAN720/UFCagent/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.13-green.svg)](package.json)

[English](README.en.md) · [参与贡献](CONTRIBUTING.md) · [第三方来源](THIRD_PARTY_NOTICES.md) · [安全问题](SECURITY.md)

一个支持中英文的 UFC 数据与分析 Web 应用，把官方榜单、ESPN 赛事与选手记录、可解释对阵评分和可选的 AI 工具问答放在同一页面。没有模型 API 密钥也能使用数据查询和对阵分析。

**项目为独立爱好者项目，与 UFC、ESPN 无隶属或背书关系。对阵结果为实验性数据倾向评分，不是已验证的未来获胜概率。**

## 功能一览

| 功能 | 实际行为 |
| --- | --- |
| 赛事与消息 | 显示近期及未来赛事、对阵、新闻标题、来源链接和抓取时间 |
| 选手档案 | 中英文姓名搜索、职业战绩、逐场比赛历史、身高、体重及可用技术统计 |
| 排名 | Media / Meta 双榜、全部官方量级、男子及女子 P4P；P4P 不当作量级冠军 |
| 对阵分析 | 同性别、同量级校验；历史逻辑回归评分与明确标注的规则回退 |
| AI 助手 | 可选 OpenAI Responses / Chat 兼容工具调用，支持上下文追问与来源展示 |
| 双语体验 | 浏览器保存语言选择、常用译名及单位转换、公开新闻标题翻译 |
| 回测复现 | 按时间划分训练 / 校准 / 测试，提供简单基线及逐场测试预测下载 |
| Windows 启动 | 可选桌面启动 / 停止快捷方式，后台启动并检查服务是否就绪 |

## 目录导航

- [启动](#启动)
- [项目结构与请求流程](#项目结构与请求流程)
- [常用命令](#常用命令)
- [中英文切换](#中英文切换)
- [技术与数据](#技术与数据)
- [AI 问答与配置](#ai-问答与配置)
- [对阵评分与历史验证](#对阵评分与历史验证)
- [API](#api)
- [部署](#部署)
- [验证与维护](#验证与维护)
- [常见问题](#常见问题)
- [许可证](#许可证)

## 启动

### 快速开始

需要 **Node.js >= 22.13.0**、npm 和 Git。该要求包含项目使用的 JSON import attributes 语法；过旧的 Node.js 无法运行。Windows、macOS 和 Linux 均可使用命令行启动。

```bash
git clone https://github.com/FMAN720/UFCagent.git
cd UFCagent
npm ci
npm run dev
```

打开终端显示的地址，默认是 `http://localhost:3000`。数据模式不需要注册模型服务。开发服务器使用 Vinext + Vite 和 Cloudflare 本地运行时，不依赖 Codex 或个人 Sites 项目配置。

```bash
npm test
npm run typecheck
npm run build
npm start
```

`npm start` 在构建完成后启动 Wrangler 本地生产预览，使用 `dist/server/wrangler.json`；端口以终端输出为准。它不会把网站部署到互联网。

### Windows 桌面快捷方式（可选）

首次先执行上述依赖安装，再在项目根目录创建快捷方式：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\create-desktop-shortcuts.ps1
```

此命令会在当前用户桌面创建启动和停止快捷方式。日常使用可以双击桌面 **UFC 智能助手**：在后台启动本地项目，等待就绪后打开浏览器。已运行时直接打开页面，不会重复启动。关闭浏览器不会停止后台；使用桌面 **停止 UFC 智能助手** 关闭服务。重启电脑后再次双击启动图标即可，不需要先打开 Codex。

启动通常需要等待几秒到几十秒。日志保存在项目 `.launcher` 目录。快捷方式只停止由自身启动并核验身份的进程；手动运行 `npm run dev` 的服务请在原终端按 Ctrl+C 停止。请保留项目目录，移动目录后需重新创建快捷方式：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\create-desktop-shortcuts.ps1
```

图标文件已经包含在仓库中。修改图标后，可使用已声明的 `sharp` 开发依赖重新生成：

```bash
node scripts/build-desktop-icons.mjs
```

随后再次创建快捷方式应用新图标。图标来源及商标说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 项目结构与请求流程

```text
UFCagent/
├── app/
│   ├── page.tsx                  # 主界面、筛选、对话和对阵分析
│   ├── locale.tsx                # 语言上下文及偏好保存
│   └── api/ufc/route.ts           # GET / POST 同源 API、输入校验与限流
├── components/ui/                # 复用界面组件
├── lib/
│   ├── i18n/                     # 界面文案、领域词汇、新闻标题译文
│   └── ufc/
│       ├── data.mjs              # 固定数据源、缓存、请求合并与快照回退
│       ├── parsers.mjs           # 外部 HTML / JSON 转结构化数据
│       ├── agent.mjs             # 数据查询路由与对阵结果组织
│       ├── assistant.mjs         # 模型协议、工具调用、上下文与降级
│       ├── prediction.mjs        # 历史模型选择与规则回退
│       ├── backtest.mjs          # 赛前特征重建、训练及评价
│       ├── translation.mjs       # 公开新闻标题翻译及缓存
│       ├── snapshot.json         # 失败回退所需的结构化公开数据
│       └── model/                # 模型权重、状态与报告
├── data/ufc-history.json          # 结构化历史赛果与 SHA-256
├── public/reports/backtest.json   # 可下载的报告及测试预测
├── assets/desktop/               # 可选 Windows 快捷方式图标
├── scripts/                      # 数据导入、训练、探针和桌面工具
├── tests/                        # Node.js 测试与已清理的夹具
└── .github/workflows/ci.yml       # 安装、测试、类型检查与生产构建
```

浏览器请求 `/api/ufc`，服务端解析固定来源的数据，再统一返回来源、时间和新鲜度。AI 模式下，模型只能调用已定义的查询工具；工具仍走相同的数据与评分模块。API 密钥只在服务端使用。

历史训练是一条独立的离线流程：导入赛果 → 校验哈希 → 按日期重建赛前特征 → 训练 → 独立校准 → 测试 → 写入模型和报告。普通页面请求不会自动重新训练。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm ci` | 按锁文件安装依赖，适合首次检出与 CI |
| `npm run dev` | 本地开发与热更新 |
| `npm run build` | 构建浏览器与 Cloudflare Worker 产物 |
| `npm start` | 预览已构建的 Worker |
| `npm test` | 运行解析、语言、模型工具与回测测试 |
| `npm run typecheck` | TypeScript 静态检查 |
| `npm run lint` | 运行已有 oxlint 检查 |
| `npm run format` | 格式化源码，会修改文件 |
| `npm run data:history` | 从 ESPN 导入历史赛果，需要外网 |
| `npm run model:train` | 用仓库历史数据重建模型与报告 |
| `node scripts/build-snapshot.mjs` | 从 `data/raw` 已抓取内容构建快照 |
| `node scripts/smoke.mjs http://localhost:3000` | 对已运行服务执行 HTTP 冒烟检查 |

## 中英文切换

右上角的「中文 / English」切换整站语言，并在当前浏览器保存选择。首次访问根据浏览器语言选择中文或英文；无法使用本地存储时仍可切换。切换不清空选手、榜单筛选、对话或预测结果。英文界面同时支持英文查询，例如 `Show Zhang Weili’s record`、`Women’s flyweight rankings`、`Upcoming UFC events`。

界面文案位于 `lib/i18n/messages.mjs`；常见选手姓名、国家、量级和比赛术语位于 `lib/i18n/domain.mjs`。中文档案将身高、臂展和体重转换为厘米/千克。译名只用于展示，选手 ID、原始数据、排名计算和来源链接不变；未知专名保留原文，避免猜造译名。时间在两种语言下均为北京时间 UTC+8。

新闻中文标题按原始标题精确匹配已整理译文；新标题通过 MyMemory 官方 GET 接口翻译，注明机器翻译，可点击「查看英文原文」切回。翻译失败、超时或超限会明确显示英文原文，不把错误提示当作译文。只向服务发送已从 ESPN 获取的公开标题，不发送用户问题或任意客户端文本。无需 GPT API，也不读取用户的 GPT 密钥。

翻译成功缓存 24 小时、失败缓存 1 分钟，每实例最多 256 条，合并重复请求，每次最多并发 3 条；跨实例缓存不共享。MyMemory 免费匿名接口有额度限制，当前未配置付费服务。参考：[接口说明](https://mymemory.translated.net/doc/spec.php)、[服务额度](https://mymemory.translated.net/doc/usagelimits.php)。

`GET /api/ufc?action=news-translations` 返回当前新闻的 `id`、原始 `title`、`translatedTitle` 和 `status`（curated/machine/unavailable）。前端同时核对 ID 和原标题，避免标题更新后错配译文。

## 技术与数据

- React 19 + TypeScript + Vinext / Vite；服务端兼容 Cloudflare Workers。
- `app/api/ufc/route.ts` 提供同源 API。浏览器不直接请求第三方数据，避免跨域问题。
- UFC 官方葡语站提供媒体榜、Meta 榜及技术统计；量级名称翻译为中文，榜单成员与排名直接解析，不硬编码当前冠军。
- ESPN 公开接口提供赛事、新闻、选手总战绩和逐场记录。新闻仅展示标题、发布时间与原文链接。
- 无商业数据 SLA。公开接口可能变更、限流或滞后；抓取时间不代表来源内容更新时间。
- 赛事按请求时刻前 14 天至后 120 天查询，排除 Contender Series，显示北京时间。数据刷新按需进行：赛事 5 分钟、消息 10 分钟、排名 15 分钟、选手和搜索 1 小时。点击“重新获取”仍尊重服务端缓存期限。
- 请求 10 秒超时；同一查询合并；内存缓存上限 128 项。失败使用有抓取时间的快照，明确标记历史数据；从不将失败抓取时间写成成功时间。无持久后台定时任务。冷启动快照位于 `lib/ufc/snapshot.json`，只含抓取到的结构化公开数据。
- 限流通过 Cloudflare IP 头识别访问者，每实例每 IP 每分钟 60 次；本地无此请求头时共享一个限流桶。内存缓存及限流非跨实例共享；如扩大服务，应迁移到持久共享缓存和边缘限流。

## AI 问答与配置

助手支持 OpenAI Responses API，以及支持工具调用的 OpenAI Chat Completions 兼容服务。模型可检索选手、档案、技术统计、排名、赛事、新闻、对阵评分和回测报告，再依据工具结果解释。保留最多 8 条近期消息（每条最多 1200 字），支持追问；点击“清空对话”清除页面内存中的对话与当前选手。回复标明 AI 分析或数据查询模式，并显示实际获取的来源和工具状态。语言切换保留已生成回答的原文；新回答遵循当前界面语言。

**没有密钥时，AI 自由问答不会启用。** 数据查询和对阵分析仍可使用；模型超时、额度或认证错误时明确降级，不伪装成模型回答。已配置状态只证明服务器检测到配置，不代表连接已验证；实际发送问题后才能验证模型服务。

本地首次配置（Windows）：

```powershell
Copy-Item .env.example .dev.vars
```

macOS / Linux 使用 `cp .env.example .dev.vars`。

在 `.dev.vars` 中填写 `UFC_MODEL_API_KEY`，再重新运行 `npm run dev`。如果文件已经存在，请直接编辑，不要覆盖现有密钥。默认 `UFC_MODEL_BASE_URL=https://api.openai.com/v1`、`UFC_MODEL_PROTOCOL=responses`、`UFC_MODEL_NAME=gpt-5-mini`。也支持服务端的 `OPENAI_API_KEY`。其他兼容服务请设置其 HTTPS API 基础地址、准确模型名称和 `UFC_MODEL_PROTOCOL=chat`；兼容服务仍需支持工具调用，无法保证所有第三方实现可用。

| 变量 | 默认值 / 含义 |
| --- | --- |
| `UFC_MODEL_API_KEY` | 可选，服务端模型密钥；空值表示数据模式 |
| `OPENAI_API_KEY` | `UFC_MODEL_API_KEY` 未设置时使用的备用密钥 |
| `UFC_MODEL_BASE_URL` | `https://api.openai.com/v1`，必须为 HTTPS 基础地址 |
| `UFC_MODEL_PROTOCOL` | `responses`；兼容 Chat Completions 时设置 `chat` |
| `UFC_MODEL_NAME` | `gpt-5-mini`，按你的服务商可用模型调整 |

线上部署需在 Cloudflare Worker 环境中设置同名变量，将 API 密钥标为 secret。构建产物和 GitHub 不包含本地 `.dev.vars`。密钥不放入 Vite 配置，不使用 `NEXT_PUBLIC_` / `VITE_` 前缀；`.dev.vars*` 和 `.env*` 均被 Git 忽略，只有不含真实密钥的 `.env.example` 被提交。

启用 AI 后，所选服务会接收问题、近期对话及工具检索的公开 UFC 数据；API 调用按所选服务的账户计费。OpenAI 请求设置 `store:false`，不代表第三方服务拥有相同的数据保留政策。每次问题最多 6 轮模型请求、8 次受限工具执行；不允许模型请求任意网址，不把外部网页内容当系统指令，前端不渲染模型 HTML。模型输出依然可能错误，来源链接不等于每项推断都已验证。当前模型流程使用模拟服务测试，未配置真实密钥时不能宣称已完成真实模型联调。

接口依据：[OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)、[GPT-5 mini](https://developers.openai.com/api/docs/models/gpt-5-mini)。

## 对阵评分与历史验证

对阵页显示 **0–100 的数据倾向评分，不显示获胜概率**。当前有两种评分来源，界面明确区分：

- 历史训练模型：仅使用赛前可重建的 UFC 赛果特征，包括 Elo 对手强度、平滑 UFC 胜率、近五场表现、出场经验与休赛时间；逻辑回归权重由训练集拟合，温度参数由独立校准集选择。两名选手均需至少 3 场已收录 UFC 明确胜负记录。
- 规则回退：模型历史超过 30 天、选手已有更新赛果或历史样本不足时，使用生涯战绩、近期赛果和双方可用技术均值的人工权重。此模式**未经历史验证，回测报告不适用于它**。

两种模式均拒绝相同选手、未知或不同性别、不同量级、职业战绩缺失或少于 5 场的对阵。历史模型不使用当前职业战绩作为特征；职业战绩仅用于显示和当前请求的基础可比性校验。

当前数据包含 ESPN 2010 年起的 **7,239 场明确胜负 UFC 比赛**。导入只保留赛事名称以 UFC 开头的已完成比赛，排除平局、NC、缺失结果和其他赛事；不使用历史接口中会随时间更新的职业总战绩。2010–2014 年用于初始化历史状态，2015–2021 年训练（1,482 场），2022–2023 年校准（543 场），2024–2025 年独立测试（580 场）。测试期另有 433 场因一方历史不足 3 场而排除。

按 UTC 日期依次重建特征，同日所有比赛先生成特征，再更新赛果。测试期中较早比赛的结果可以更新后续比赛的历史状态，但不重新拟合权重或校准参数。测试结果不用于选择温度或重新训练。

| 方法 | 测试命中率 | Brier 误差（越低越好） |
| --- | --- | --- |
| 历史训练模型 | 62.1% | 0.237 |
| Elo 基线 | 56.2% | 0.244 |
| 历史 UFC 胜率基线 | 62.7% | 0.232 |
| 双方各半 | 50.0% | 0.250 |

训练模型尚未胜过所有简单基线。命中率将完全相同的双方评分计半分；报告也提供对数损失、逐年表现、校准分组及描述性的 Wilson 区间。选手重复出场会导致样本相关；回溯来源可能包含后续更正；当前没有前瞻实测、赔率对照，也没有伤病、降重、年龄、臂展或技术风格特征。以上指标不保证未来比赛表现。

可复现命令：

```powershell
npm run data:history
npm run model:train
npm test
```

`data/ufc-history.json` 为带来源和 SHA-256 的结构化赛果；`data/raw/history` 为忽略提交的原始缓存。导入默认复用完整历史年份缓存并刷新本年，更新旧年更正时可手动移走对应年份缓存后重取。`lib/ufc/model/artifact.json` 为权重、温度和当前历史状态，`lib/ufc/model/report.json` 为报告；`public/reports/backtest.json` 提供报告及全部测试预测下载。训练脚本核对数据哈希，报告记录数据抓取日期和覆盖范围。更新这些文件后需重新构建部署；没有后台自动训练任务。

职业 MMA 胜–负–平不等于 UFC 内战绩，也未包含单独的无效比赛计数；逐场来源记录保留 NC 等结果。不同来源记录可能不同步。

## API

| 请求 | 用途 |
| --- | --- |
| `GET /api/ufc?action=rankings` | 全部媒体与 Meta 榜单 |
| `GET /api/ufc?action=events` | 近期与未来赛事、对阵 |
| `GET /api/ufc?action=news` | 新闻标题及原文 |
| `GET /api/ufc?action=search&q=Zhang%20Weili` | 搜索选手 |
| `GET /api/ufc?action=fighter&id=4350762` | 选手档案与比赛历史 |
| `GET /api/ufc?action=assistant-status` | 模型配置状态，不返回密钥 |
| `GET /api/ufc?action=model-report` | 历史回测与基线报告 |
| `POST /api/ufc`，`{"action":"ask","question":"轻量级排名","locale":"zh","history":[]}` | 模型工具问答或明确标注的数据查询回退 |
| `POST /api/ufc`，`{"action":"predict","a":"4350762","b":"2554705"}` | 对阵预测 |

数据响应包含 `data`、`source`、`fetchedAt`、`freshness`（live/cache/snapshot）和 `warning`。接口限制输入长度及选手 ID，第三方域名固定白名单，页面不渲染第三方 HTML。工具不接受任意 URL。

## 验证与维护

`npm test` 覆盖解析、双榜分离、身份校验、错误响应、预测对称性/拒绝条件、日期窗口和缓存回退。测试使用 `tests/fixtures` 中已清理的真实页面夹具，可在全新检出后直接运行。开发时下载的原始页面放在 `data/raw`（不提交），仅用于重建夹具和快照。重新获取可运行 `node scripts/probe.mjs`、`node scripts/probe2.mjs`，这两个脚本是开发探针，部分不支持的候选接口会报错。运行 `node scripts/build-snapshot.mjs` 更新结构化快照，检查日志和抓取日期后再部署。首次两份探针中的历史日期仅用于测试夹具；运行时窗口是动态的。

支持时注册 `ask_ufc_agent` WebMCP 工具；不支持 WebMCP 的浏览器仍正常使用。没有可用 WebMCP 上下文时不能声称完成此工具的浏览器验证。

## 部署

项目使用 Cloudflare Workers 运行时（API 直接导入 `cloudflare:workers`），仓库默认 Worker 名称为 `ufcagent`。该公开版本不包含原作者的 Sites 项目 ID，也不需要 `.openai/hosting.json`。

先运行 `npm run build` 与 `npm start` 检查本地构建。确认你的 Cloudflare 账号后，可使用 Wrangler 发布：

```bash
npx wrangler login
npx wrangler deploy --config dist/server/wrangler.json
```

同一账号中 Worker 名称如已被占用，应先在 `vite.config.ts` 的 `localBindingConfig.name` 中修改名称并重新构建。没有使用数据库或对象存储绑定。

启用线上 AI 时，在 Cloudflare Dashboard 为该 Worker 配置非敏感变量和 API secret，或使用：

```bash
npx wrangler secret put UFC_MODEL_API_KEY --config dist/server/wrangler.json
```

部署后通过 `/api/ufc?action=assistant-status` 检查模式，并实际发送问题验证模型连通性。GitHub Actions 只验证代码，不执行部署，也不需要任何模型密钥。此开源发布不提供已经验证的公共演示地址。

## 常见问题

**为什么没有密钥也能聊天？** 数据模式会解析受支持的选手、榜单、赛事和对阵查询。自由问答必须配置模型服务；页面会区分两种模式。

**为什么显示历史快照？** 第三方来源可能不可达或格式变化。应用使用已有快照并保留原抓取时间；“重新获取”不会绕过服务端缓存期限。

**为什么当前对阵使用规则评分？** 仓库模型不会自动更新。历史超过 30 天、一方已有更新 UFC 赛果或历史样本不足时会回退；过去的回测指标不适用于本次规则评分。

**为什么职业胜场与 UFC 胜场不同？** 职业 MMA 战绩包含其他赛事；历史模型只使用已收录 UFC 明确胜负比赛。

**为什么新闻没有中文译文？** 未整理的新标题需要访问 MyMemory；超时或额度不足时保留英文原文，避免误导。

**为什么 `npm start` 找不到配置？** 先运行 `npm run build`；`dist/server/wrangler.json` 是生成文件，不在 Git 中。

**为什么桌面启动失败？** 先检查 `node --version`、执行 `npm ci`，再检查 `.launcher` 中的日志与端口 3000。手动启动的开发服务器请在原终端停止；移动项目后重新创建快捷方式。

**是否可以直接部署为普通 Next.js / 静态站点？** 当前工程使用 Vinext 与 Cloudflare Worker 服务端 API；迁移到其他运行环境需适配绑定及服务端运行方式。

## 许可证

项目自有代码与文档采用 [MIT License](LICENSE)。第三方依赖、公开体育数据、解析夹具和 UFC 商标不因本项目代码许可证而获得新的授权，详见 [第三方来源与说明](THIRD_PARTY_NOTICES.md)。

欢迎通过 [Issues](https://github.com/FMAN720/UFCagent/issues) 和 Pull Request 贡献。提交问题时请保留复现步骤、来源、抓取时间和已脱敏日志。
