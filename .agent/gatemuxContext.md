# GateMux 发行版（gmcut）需求共识与交接说明

本文件沉淀 2026-11-23 的需求分析与决策，供后续对话接手 gmcut 相关开发。用户后续明确指令优先；更新本文件时保留未被撤销的决策，不把某次局部任务当成替换整体目标。代码现状以接手时实际读取的仓库为准，本文的“改动点”是计划，不代表已经实现。

## 主旨

本仓库 fork 自 [HBAI-Ltd/Toonflow-app](https://github.com/HBAI-Ltd/Toonflow-app)（`origin` 为 `emmelleai/Toonflow-app`），以 **gmcut** 品牌作为 [GateMux](https://gatemux.cn/llms.txt) 的第三方应用发布：

- 所有模型（文本、图片、视频、音频）使用 GateMux 提供的模型，由用户通过 GateMux 授权后用自己的余额付费。
- 尽可能保持与上游同步：定制优先放在新增文件，经渠道与能力开关切换，少改上游文件。

## 已确定的决策

| # | 事项 | 决定 |
| --- | --- | --- |
| 1 | 首发形态 | 只做桌面客户端（Windows / macOS / Linux）。独立 Web 仅供个人自部署单人使用，不做公网多用户托管。 |
| 2 | 授权方式 | GateMux **轮询式 OAuth**（`oauth-polling`），凭证 `pat` 有效 90 天、可续期；不用回调式。 |
| 3 | 原 Toonflow 平台功能 | 插件市场、作品社区、首页广告与赞助商、Toonflow 账号、钱包、子账号**全部关闭**，不转发给 `api.toonflow.net`。 |
| 4 | 模型范围 | 默认只出现 GateMux 模型；自定义供应商、内置供应商列表、供应商调试、本地 ASR、ComfyUI 等高级入口由服务端能力开关隐藏，**代码保留**，开发者模式可打开。 |
| 5 | 多租户 | 本期不动，保持上游“开发中”屏障（见 [multiTenantContext.md](multiTenantContext.md)）。 |
| 6 | 品牌与域名 | 品牌名 `gmcut`，域名 `gmcut.gatemux.cn`。 |
| 7 | 自动更新 | 自行部署 `apps/updateServer`，替换 `api.toonflow.net/web/version/desktopUpdates`。 |
| 8 | 匿名遥测 | 保留，改为上报到 gmcut 自己的服务器，替换 `api.toonflow.net/web/telemetry/report`。 |
| 9 | 开源 | gmcut 开源，许可沿用 MIT；gmcut 名称与 logo 保留权利，官方安装包只由用户发布。必须确保开源不泄露 GateMux 相关源码或认证信息（见“开源防泄露规则”）。 |
| 10 | 产品定位 | gmcut 的主要目的是做 **GateMux 生态的标杆应用**，不以自身营收为主要目标（见“定位与成功标准”）。 |

不做桌面以外形态的原因：standalone server 无鉴权（上游明确不建议公开主端口），`settings.json` 与账号 token 全局唯一，工作区共享 `data/workspaces`，插件、Agent、供应商源码在服务端无沙箱执行。公网多用户 Web 等同重启多租户方向，与决策 5 冲突。

## 定位与成功标准

2026-11-26 用户确定：gmcut 是 GateMux 生态的标杆应用。它的价值不只在应用本身，还在于为平台证明了什么、沉淀了什么；即使将来被其他产品取代，接入范例、平台改进与用户仍然保留。

### 成功标准

不以 gmcut 自身营收衡量（平台自有应用本身没有分成），按以下生态指标衡量：

| 维度 | 指标 |
| --- | --- |
| 拉动平台消耗 | 经 gmcut 产生的媒体生成消耗（图片、视频、语音），以 GateMux 归因用量为准 |
| 带来新用户 | 因 gmcut 新注册 GateMux 的用户数，及其后续是否使用其他应用 |
| 用户活跃 | 每周活跃创作者数、完成完整一集的用户数 |
| 参考价值 | 参考 gmcut 接入 GateMux 的开发者数量，开源仓库的 star 与 fork |
| 宣传素材 | 用 gmcut 制作、可公开展示的短剧作品 |

### 由定位带来的开发要求

1. **接入代码本身就是产品。** 轮询授权、续期、错误处理、fal 队列提交与恢复、余额与费用显示等 GateMux 相关代码，要写得清晰、带必要注释、边界集中，便于其他开发者参考或单独复用。优先级高于在 gmcut 中增加创作功能。
2. **展示 GateMux 的特色能力**：一个账号与余额使用全部模型、无需配置 API Key；生成前显示预估费用、生成后显示实际花费；月度上限与余额不足时给出友好提示和充值引导；在合适处使用多上游路由、结果缓存（`gatemux_cache`）与 GateMux MCP。
3. **质量门槛高。** 标杆应用代表平台形象：崩溃、含糊的报错、不清楚的扣费都会被算到 GateMux 头上，错误路径与提示须完整。
4. **自用验证。** 每个实施阶段完成后，都要用 gmcut 真实制作一段或一集短剧，记录卡点、费用与体验问题，再进入下一阶段。
5. **反馈平台缺口。** 开发与自用中发现的平台问题整理后反馈给 GateMux。已发现：
   - 模型目录没有时长、分辨率、生成模式等参数定义，每个应用只能自行维护；
   - `/v1/billing/credential/*` 不支持用户授权得到的 `pat`；
   - 安全事件回调要求公网 HTTPS，桌面应用无法接收。

### 待评估：向上游贡献 GateMux 供应商

除 gmcut 外，可考虑把 GateMux 作为可选供应商贡献给上游 Toonflow，让所有 Toonflow 用户都能选用 GateMux，扩大生态覆盖，也缩小 gmcut 与上游的差异。

- GateMux 供应商源码按可同时用于 gmcut 与上游的形式编写，不依赖 gmcut 专有代码。
- 风险：上游有自己的“Toonflow 官方模型平台”，未必接受竞争渠道。需要用户先与上游沟通；未获用户明确要求前，不向上游提交任何内容。

## GateMux 接入要点

来源：`llms.txt` 及其子文档 developer-quickstart、oauth-polling、oauth-redirect、scopes、app-review、errors、attribution、openai-compat、api-reference、billing-api、security-events、routing、pricing-tiers、revenue-share、models、`rest.gatemux.cn/catalog/models`。部分内容经抓取工具转述，编码前对照原文核实字段。

### 地址与协议

- REST 根地址 `https://rest.gatemux.cn`；文本 `POST /v1/chat/completions`（OpenAI 兼容）、`/v1/messages`（Anthropic 兼容）、`/v1/responses`。
- 图片同步 `POST /v1/images/generations`（最长等 120 秒，超时 504 但任务可能继续计费）。
- 媒体异步走 fal 队列：提交 `POST /{model_id}` → 返回 `request_id`、`status_url`、`response_url`、`cancel_url`（按返回值使用）→ 状态 `GET /{model_id}/requests/{request_id}/status`（`IN_QUEUE` → `IN_PROGRESS` → `COMPLETED`）→ 结果 `GET /{model_id}/requests/{request_id}`（图片 `images[].url`，视频 `video.url`，链接可能很快过期）→ 取消 `PUT .../cancel`（仅 `IN_QUEUE` 可取消并全额退款）。上传 `POST /storage/upload`（20 MiB，需 `files:write`）。
- 语音合成 `POST /v1/audio/speech`（`input` ≤ 600 字）；识别 `POST /v1/audio/transcriptions`（≤ 10 MB、≤ 3 分钟）。
- 模型列表 `GET /v1/models`（字段含 `protocols`，非对话模型为空数组）；目录 `GET /catalog/models`（含 `pricing`、`pricing_tier`、`capabilities`）。**目录不提供时长、分辨率、生成模式等参数 schema**，只在 `description` 和定价键中体现；精确参数可经 MCP `get_model_schema` 查询，否则需在供应商源码中维护。
- 模型 ID 形如 `gatemux/<name>`，推荐使用多上游逻辑 ID（自动路由与故障切换）；`:provider` 后缀锁定上游会放弃切换。

### 轮询授权

1. `POST /v1/oauth/authorize`（无需认证）：`client_id`（`app_…`）、`code_challenge`、`code_challenge_method: "S256"`、`scope`（数组）、可选 `device_id`、`device_name`。返回 `code`（`dac_…`，10 分钟有效）、`verification_url`（主站页面）、`interval`（秒）。
2. 打开 `verification_url`，按 `interval` 轮询 `POST /v1/oauth/token`，体 `{code, code_verifier}`：`428 authorization_pending` 继续；`200` 返回 `pat`（只返回一次）、`scopes`、`expires_at`、`app_id`；`400 invalid_grant` / `app_unavailable` 需重新发起。批准后 verifier 错一次即作废。
3. 调用时 `Authorization: Key pat-gatemux-…`（或 `Bearer`）。
4. 续期 `POST /v1/oauth/renew`（携带旧凭证，仅到期前 30 天内；旧凭证立即作废，返回新凭证）。错误 `renew_too_early`、`credential_expired`。
5. 退出 `POST /v1/oauth/revoke`。用户也可在 GateMux 控制台“设备”页撤销。
6. 限流：每 IP 每分钟 10 次 authorize；每应用最多 100 个待批准。
7. 文档建议把 `pat` 存入系统钥匙串；阶段 2 采用配置文件中 `settings` 之外的独立项 `gatemuxCredential`（`settings.json`，`0o600`），不随设置接口下发前端。改为系统钥匙串列为后续优化。
8. 2026-11-27 实测补充（文档未写明）：撤销为 `POST /v1/oauth/revoke`，JSON 体 `{"token": pat}`，成功返回 `{"status":"revoked","revoked":[...]}`；续期在 `Authorization` 头携带旧凭证（`Key` 与 `Bearer` 均可）；错误统一为 `{"error":{"message","type","code"}}`，缺少 Authorization 头时为 `{"detail": ...}`。令牌接口 200 响应已在 2026-11-27 真实授权中验证（`pat`、`expires_at` 按 Unix 秒解析正确，有效期 90 天）；续期 200 响应要到期前 30 天内才能实测，届时再核对。

### gmcut 应用信息

- `app_id`：`app_6192bdd29fa6870a`（公开标识，草稿状态）。服务端默认使用它，启动或构建时可用环境变量 `GATEMUX_APP_ID` 覆盖，用于区分测试应用与正式应用。
- 申请的权限：`models:read`、`responses:create`、`media:create`、`files:write`、`account:read`、`billing:read`；不申请 `workflow:create`、`openid`、`email`。实际授予范围为申请范围与应用登记范围的交集。
- 不申请 `client_secret`；回调地址、可嵌入站点、可信出口 IP 均留空（桌面应用出口 IP 不固定，填写会导致所有调用被拒绝）。

### 权限（scope）与计费

| scope | 用途 | gmcut 是否需要 |
| --- | --- | --- |
| `models:read` | `/v1/models` | 需要 |
| `responses:create` | 文本对话（付费） | 需要 |
| `media:create` | 图片、视频、fal 队列、媒体任务（付费） | 需要 |
| `files:write` | `/storage/upload` 上传参考素材 | 需要（参考图、首尾帧） |
| `account:read` | `/v1/account/me` 身份字段 | 需要 |
| `billing:read` | 余额（`/v1/account/me` 的 `wallet.balance`）、`/v1/billing/usage`、`/v1/billing/transactions`（仅本应用数据） | 需要（余额与用量显示） |
| `workflow:create`、`openid`、`email` | 工作流、OIDC 登录 | 暂不需要 |

- 语音合成、识别所需 scope 文档未单列，编码前核实。
- 余额没有单独接口，读 `/v1/account/me` 的 `wallet`。`/v1/billing/credential/*` 只接受 `sk-` 服务端密钥，**不能用 pat**。
- 用户自付：扣用户余额，用量按凭证中绑定的 `app_id` 归因（请求头里的 app id 会被忽略）。文本后付费，图片、视频先预占再结算。
- 用户默认每应用月度上限（¥50 / $10），触发 `429 budget_exceeded`（`window: app_monthly`，带 `reset_at`），应提示用户到控制台调整，不要重试。
- 分成：自 2026-09-08 起文本模型按成本价出售，文本用量没有分成；媒体与语音仍有分成。平台自有应用无分成。

### 错误处理（调用侧）

- 统一格式 `{"error": {"message", "type", "code"}}`，按 `code` 分支。
- `401 credential_invalid`：凭证撤销、过期或应用停用，清除本地凭证并引导重新授权。
- `403 scope_denied`（含 `required_scope`）、`403 model_not_allowed`（应用登记的模型白名单之外）。
- `402 insufficient_balance`：引导充值。
- `429 budget_exceeded`、`429 app_rate_limited`、`429 gateway_busy`：按 `Retry-After` 或 `reset_at` 提示。
- `503 upstream_unavailable`：平台侧问题，不当作余额不足。
- 安全事件回调（`grant.revoked` 等）需要公网 HTTPS 地址，桌面端无法接收，依赖下一次调用返回 401 处理。

### 审核与上架

- 前置：运营开通开放平台（未开通时 `/v1/oauth/*` 返回 404）；开发者主体完成实名或企业认证。
- 草稿应用只能由开发者成员和测试用户（最多 100 人）授权，可用于自测。
- 申请了付费 scope，属于最高审核级别：需在“主体设置 → 域名验证”中为官网域名添加 DNS TXT 记录。`gmcut.gatemux.cn` 是 `gatemux.cn` 的子域，**需要能控制 `gatemux.cn` 的 DNS**；审核还会确认用户能看到费用、有收费提示。
- 提交材料：名称（不得冒充平台或知名品牌）、描述与分类、隐私政策 URL（说明如何处理经 GateMux 获取的用户内容，同时说明遥测）、可验证入口（测试账号或下载/演示地址）、每个 scope 的一句话理由。
- 审核约 3 个工作日；名称、类型、回调地址变更或扩大 scope 需重审。

## 现有代码链路与改动点

### 可复用的扩展点

- 渠道：[apps/server/src/utils/channel/index.ts](../apps/server/src/utils/channel/index.ts) 按 `TOONFLOW_CHANNEL` 选择实现，目前只有 [toonflow.ts](../apps/server/src/utils/channel/toonflow.ts)；接口见 [types.ts](../apps/server/src/utils/channel/types.ts)。对应路由在 `apps/server/src/routes/channel/{user,wallet,subAccounts,account,plugin,community,model,provider}/`。
- 账号供应商：[account/install.ts](../apps/server/src/routes/providers/account/install.ts) → `installAccountProvider`（[utils/media/provider.ts](../apps/server/src/utils/media/provider.ts)），把渠道下发的媒体源码写成 `toonflow.ts`；文本供应商由 `accountProviderSchema` / `getAccountProvider`（[utils/ai/provider.ts](../apps/server/src/utils/ai/provider.ts)）注入，排在自定义供应商之前。账号 id 与文件名写死为 `toonflow`。
- 媒体供应商接口：[packages/providers/types.d.ts](../packages/providers/types.d.ts) 的 `ProviderDefinition`（`generateImage/Video/Audio`、`saveTaskData` + `resumeTask`、`getPrice`、`getBalance`），源码在 `node:vm` 中执行。
- 文本模型经 pi-ai 以 `openai-completions` 调用，GateMux 原生兼容。

### 新增文件（不与上游冲突）

| 改动 | 说明 |
| --- | --- |
| `apps/server/src/utils/channel/gatemux.ts` | 实现 `Channel`：`getProviderSource` 返回本地打包的文本与媒体源码，`getVendors` 只返回 GateMux；登录、钱包、插件市场、社区、广告等方法抛出“不支持”。在 `channel/index.ts` 注册一行。 |
| GateMux 授权路由 | 发起授权、轮询状态、续期、退出，服务端完成 PKCE，凭证只留后端。按“一个接口一个文件”放在新目录，新增后执行 `bun run routes`。 |
| GateMux 媒体供应商源码 | fal 队列提交 → `saveTaskData` 保存 `request_id` → 轮询 → `resumeTask` 恢复 → 取消；参考素材经 `/storage/upload`；语音合成走 `/v1/audio/speech`；`getBalance` 读 `/v1/account/me`；`getPrice` 读目录定价（注意峰谷 `pricing_tier`）。模型参数（模式、时长、分辨率）在源码中维护。 |
| GateMux 文本供应商配置 | `apiUrl=https://rest.gatemux.cn/v1`，模型取 `/v1/models` 中 `protocols` 含 `openai-completions` 的项。 |
| 渠道能力开关 | 服务端下发 `capabilities`，前端据此隐藏入口。 |

账号供应商的内部 id 暂沿用 `toonflow`（界面显示 GateMux），避免改动 `accountProviderSchema`、`installAccountProvider` 中写死的 id 与文件名；需要改名时再评估上游冲突。

### 需要修改的上游文件（冲突热点，保持小 diff）

| 位置 | 改动 |
| --- | --- |
| `apps/web/src/components/settings/panels/account/`、`apps/web/src/pages/home/homeAccount.vue`、`apps/web/src/pages/hello/index.vue`、`apps/web/src/components/settings/toonflowProviderCard.vue`、`apps/web/src/components/modelLoginGuide.vue` | 登录改为“使用 GateMux 授权”，钱包与充值改为跳转 GateMux 控制台，显示余额。 |
| `settings/panels/pluginMarket/`、`pages/home/pages/explore/`、首页广告与赞助商 | 按能力开关隐藏。 |
| [apps/server/src/agent/tools/pluginMarket.ts](../apps/server/src/agent/tools/pluginMarket.ts)、`packages/tools/pluginDeveloper` 的上传部分 | 按能力开关禁用，避免 Agent 绕过界面访问插件市场。 |
| `settings/panels/languageModel/`、`mediaModel/`、`developer/` | 自定义供应商、内置供应商列表、调试入口按开关隐藏。 |
| [apps/server/src/utils/desktop/index.ts](../apps/server/src/utils/desktop/index.ts)、[apps/desktop/src/update/linuxDebUpdater.ts](../apps/desktop/src/update/linuxDebUpdater.ts) | 更新地址改为由渠道配置提供。 |
| [apps/web/src/lib/anonymousData.ts](../apps/web/src/lib/anonymousData.ts) | 遥测地址改为由渠道配置提供，用户隐私开关不变。 |
| [electrobun.config.ts](../electrobun.config.ts)、[apps/desktop/src/protocol.ts](../apps/desktop/src/protocol.ts) | 名称 `gmcut`、identifier（建议 `cn.gatemux.gmcut`）、安装协议（建议 `gmcut://`），避免与上游 Toonflow 同机冲突。 |
| `apps/web/src/App.vue`、`settings/panels/about/`、README、图标 | 品牌替换，保留 MIT 许可与原项目署名。 |
| `.github/workflows/release.yml`、`signPath.yml` | 换成 gmcut 的发布目标与签名证书。 |

地址、协议名、能力开关统一由渠道配置提供，上游代码只改为“读取配置”。这类通用化改动可考虑回馈上游，进一步缩小 fork 差异。

### 服务端（gmcut.gatemux.cn）

- 更新服务器：`apps/updateServer` 是只读静态文件服务（GET/HEAD，默认 `127.0.0.1:8091`），需反向代理与 HTTPS；发布用 `bun run publish:update`。
- 遥测接收：现有 updateServer 不能接收 POST，需新增接收端点或独立服务，数据格式沿用上游上报结构。
- 隐私政策页面：GateMux 审核必需，需说明遥测内容与去向。

## 实施阶段

每阶段完成并验证后停止，等待用户确认再进入下一阶段。阶段 2 起，验证除类型检查、构建外，还包括按“定位与成功标准”的自用验证；阶段 2（授权）与阶段 4（媒体供应商）按可复用的参考实现标准编写。

| 阶段 | 内容 |
| --- | --- |
| 0 | 添加 `upstream` 远端，建立长期定制分支；本文件即阶段 0 产出。 |
| 1 | GateMux 渠道骨架与能力开关，隐藏已关闭的功能入口。 |
| 2 | 轮询授权：授权、轮询、续期、退出、错误提示，替换账号登录界面。 |
| 3 | 文本模型接入（账号供应商），Agent 与文本节点可用。 |
| 4 | 媒体供应商源码：图片、视频、语音合成，余额与价格。 |
| 5 | 品牌、identifier、协议、更新与遥测地址、发布流水线与签名。 |
| 6 | 上架材料与审核（用户线下操作为主）。 |

## 许可与品牌合规

2026-11-24 分析结论，非法律意见；正式商用前建议请律师复核。

### 源码许可

- [LICENSE](../LICENSE) 为 MIT（Copyright (c) 2026 HBAI-Ltd；README 署名北京爱阿科技有限公司），允许商业使用、修改、分发、再许可与销售，修改部分无须开源。本仓库历史自 2026-09-21 的 v2.0.0 起即为 MIT。
- 唯一硬性义务：在软件副本中保留原版权声明与许可文本。做法：保留原 `LICENSE`，可追加 gmcut 自己的版权行（覆盖修改部分）；在安装包或“关于”页附“基于 Toonflow（MIT）开发”的说明及原许可全文。

### 品牌

- MIT 只授权代码版权，不授权商标；不得把“Toonflow”名称和 logo 用作 gmcut 的品牌，也没有义务保留。品牌须全部替换为 gmcut（logo 见 `packages/assets`、`docs/images/logo.png`），与阶段 5 一致。
- 可以如实说明“基于开源项目 Toonflow”，但不得暗示 gmcut 是官方版本或获得上游认可（上游 README 提到“官方授权的 Toonflow 商用镜像”，说明上游把品牌视为需授权资产）。
- GateMux 审核规定应用名称不得冒充知名品牌，沿用 Toonflow 名称可能被驳回。

### 第三方素材与依赖

- 3D 预演（[trumanMap/readme.md](../packages/nodes/trumanMap/readme.md)）：本地素材为原创程序化几何；AI 部分派生自 Holodeck（MIT），示例数据 CC0；人物动作来自 Quaternius（CC0）；SunCalc 为 BSD-2。均可商用，需保留对应声明。
- ThorVG、RapidJSON（`packages/startup/assets/license.txt`）为 MIT；Element Plus 许可见 `packages/i18n/src/elementPlus/license.txt`。
- 待核实：全部 npm 依赖的许可（安装依赖后生成清单，重点排查 GPL / AGPL）；按需下载的 FFmpeg 构建许可（部分构建为 GPL，若 gmcut 自行分发需遵守相应义务）。

### 风险与约束

1. **上游再次变更许可**：上游历史上从 AGPL-3.0（v1.0.8 前）改为 Apache-2.0 加附加协议（v1.0.8～v1.1.8），再改为 MIT。已按 MIT 发布的版本授权不可撤回，但若上游后续版本改为更严格的许可，合并之后的代码即受新条款约束。**每次合并上游前，先检查 `LICENSE` 与 README 许可段落是否变化；若有变化，停在最后一个 MIT 版本并重新评估。**
2. 不可沿用的上游资源：SignPath 免费代码签名（属于上游开源项目，gmcut 需自备证书）、README 中的赞助商与合作伙伴标识、上游教程文档与演示视频、插件市场中第三方作者的插件。
3. README 需为 gmcut 重写，移除上游品牌、赞助商推广与 Toonflow 链接，保留来源与许可说明。

## 开源防泄露规则

gmcut 开源后，仓库内容和完整 Git 历史都会公开。以下规则在开发、提交和发布时必须遵守；一旦误提交，仅删除文件不够，须立即作废对应凭证并清理历史。

### 2026-11-24 现状核查

- Git 历史中未发现 `sk-gatemux`、`pat-gatemux`、`rt-gatemux`、`app_…`、`client_secret` 或私钥内容。
- `.gitignore` 已忽略 `/data/`（含 `settings.json`）、`.env`、`.env.*`、`*.p12`、`*.pfx`、`*.p8`、钥匙串文件、`.claude`、`apps/updateServer/public` 与 `releases`；`.claude/settings.local.json` 未被跟踪。
- 匿名遥测只上报计数、版本、平台和画布节点类型统计，不含密钥、提示词或文件内容。
- CI 只在手动触发、推送 tag 或推送 `develop` 时运行，未使用 `pull_request_target`，凭证均来自 GitHub Actions secrets。

### 禁止进入仓库的内容

| 类别 | 内容 | 正确存放 |
| --- | --- | --- |
| GateMux 凭证 | `sk-gatemux-…` 服务端密钥、用户 `pat-gatemux-…`、`rt-gatemux-…`、测试账号密码 | 开发自测用本机 `data/settings.json` 或 `.env`（均已忽略），不写进代码、文档、截图或 issue |
| 应用密钥 | `client_secret` | gmcut 使用公开客户端（PKCE），**不申请 `client_secret`** |
| GateMux 非公开资料 | GateMux 平台自身源码、内部接口与管理端地址、未公开的价格或协议、运营联系方式、开发者门户截图中的敏感字段 | 不进入仓库；`.agent` 文档只引用公开文档（`llms.txt` 及其公开子文档） |
| 发布与运维凭证 | 代码签名证书、Apple 公证密钥、更新服务器上传凭证、遥测接收端凭证、服务器部署配置 | GitHub Actions secrets 或服务器本地；上游的 `TFROUTER_UPLOAD_*`、`SIGNPATH_API_TOKEN` 等需换成 gmcut 自己的 secrets |

`app_id` 会出现在授权请求中，本身是公开标识，可以写进配置；仍建议通过构建配置注入，便于区分测试应用与正式应用。

### 运行时凭证保护（实现阶段 2～4 时落实）

- **`pat` 不随设置下发前端。** 现有 `GET /api/settings/get` 会把整个 `settings`（包括 `toonflowAccount.token` 和自定义供应商的 `apiKey`）返回给网页，而节点插件代码也运行在同一页面里，可以读到这些内容。GateMux `pat` 必须存放在 `settings` 之外的独立配置项（或系统钥匙串）中，只在服务端读取；前端只拿到授权状态、到期时间和已授予的 scope。
- `pat` 只放在 `Authorization` 请求头中，不放进 URL、查询参数、日志、遥测、错误信息或画布 / 工作区文件；供应商报错统一经 `tool.errorMessage` 脱敏。
- GateMux MCP 自动配置时，在建立连接时注入 `Authorization`，不把 `pat` 写进 `mcpServers` 配置（该配置会经 MCP 列表接口返回前端）。
- 退出登录时调用 `POST /v1/oauth/revoke` 并删除本地凭证；收到 401 时清除本地凭证。

### 发布前检查（人工执行，不新增检查脚本）

1. 提交前查看 diff，确认没有上述禁止内容。
2. 首次公开仓库前，再次搜索全部 Git 历史中的 GateMux 凭证前缀和私钥标记。
3. 截图、录屏、issue 和文档示例中的凭证一律打码或使用占位符。
4. 若发生泄露：立即在 GateMux 控制台撤销对应凭证或轮换密钥，再清理 Git 历史；只删文件不能撤回已公开的内容。

## 后续需求（已记录，未排期）

以下需求用户已同意记录，但尚未确定排期；开始实施前需用户明确要求。

### 外部 MCP 支持 OAuth 授权

- 现状：外部 MCP 的远程连接（`http`、`sse`）只支持固定请求头（[packages/mcp/src/client.ts](../packages/mcp/src/client.ts) 中 `mcpServerSchema` 只有 `url`、`headers`），`stdio` 只支持环境变量；`packages/mcp`、`apps/server/src/utils/mcp`、MCP 设置面板中没有任何 OAuth 实现。要求浏览器授权的 MCP 服务无法接入，手动填写的 access token 过期后不会刷新。
- 方案：使用官方 `@modelcontextprotocol` 客户端 SDK 自带的 MCP 授权能力（服务端元数据发现、动态客户端注册、PKCE、刷新），通过传输层的 `authProvider` 接入。具体类名与参数以已安装的 SDK v2 版本为准，编码前核实。
- 宿主需补充：
  1. 按 MCP 服务分别持久化 client 信息、token 与 PKCE verifier（`settings` 或系统钥匙串，与 `pat` 的存储方式一并决定）。
  2. 回调地址：桌面端使用回环地址，例如 `http://127.0.0.1:<端口>/api/mcp/oauth/callback`；服务器部署需要固定回调域名。
  3. 界面：远程 MCP 增加“授权”按钮、授权状态与“断开授权”。
  4. 连接遇到 401 时触发授权，完成后重连；token 刷新交给 SDK。
- 同步策略：这是与 GateMux 无关的通用功能，优先以独立改动回馈上游，或先确认上游是否已在开发，避免 fork 内单独实现造成合并冲突。

### GateMux MCP 自动配置

- GateMux 提供 MCP 服务 `https://mcp.gatemux.cn/mcp`（如 `get_model_schema`、`run_model`、`submit_job`）。gmcut 用户授权后已有 `pat`，可由 gmcut 自动配置该 MCP 并填入 `Authorization: Key <pat>`，续期时同步更新，**不依赖上面的 MCP OAuth**。
- 注意：经 MCP 发起的生成同样扣用户余额，需在界面给出费用提示（也是 GateMux 付费 scope 的审核要求）。
- 建议在阶段 4（媒体供应商）完成后再评估是否内置。

## 与上游同步

- `git remote add upstream https://github.com/HBAI-Ltd/Toonflow-app.git`；`master` 跟踪上游，gmcut 定制在长期分支上定期 merge 上游（不 rebase）。
- 每次 merge 前检查上游许可是否变化（见“许可与品牌合规”）。
- [apps/server/src/router.ts](../apps/server/src/router.ts) 冲突不手工解决，merge 后执行 `bun run routes` 重新生成。
- 冲突热点：账号相关 Vue 组件、`bun.lock`、`packages/i18n` 的 22 份语言文件（gmcut 新增文案尽量少）。
- 不改 `packages/multiTenant`。

## 用户线下事项与风险

- 联系 GateMux 运营开通开放平台；完成主体实名或企业认证；创建应用获取 `app_id`，登记 scope 与模型白名单，添加测试用户。
- 确认能否为 `gatemux.cn` 添加 DNS TXT 验证记录；若 gmcut 属于 GateMux 平台自有应用，不享受分成。
- 准备 Windows 代码签名证书、Apple 开发者账号（macOS 公证）。
- 部署 `gmcut.gatemux.cn` 的更新、遥测接收与隐私政策页面。
- 关闭插件市场后，第三方插件只能通过安装链接或本地导入安装。
