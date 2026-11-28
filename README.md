<p align="center">
  <img src="./docs/gmcut/logo1024.png" alt="gmcut" width="120" height="120" />
</p>

<h1 align="center">gmcut</h1>

<p align="center">GateMux 生态的 AI 短剧与视频创作客户端</p>

<p align="center">
  <a href="https://github.com/emmelleai/gmcut/releases/latest"><img src="https://img.shields.io/github/v/release/emmelleai/gmcut?style=flat-square" alt="Release" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="MIT License" /></a>
</p>

gmcut 把剧本、角色、场景、分镜和视频生成放在同一块无限画布上，所有模型由 [GateMux](https://gatemux.cn) 提供：用 GateMux 账号授权一次，就能直接使用文本、图片、视频和配音模型，无需逐个配置 API Key。

gmcut 基于开源项目 [Toonflow](https://github.com/HBAI-Ltd/Toonflow-app)（MIT）构建，并持续同步上游更新。

## 功能

| 能力 | 说明 |
| --- | --- |
| 🔑 **GateMux 账号授权** | 浏览器确认后即可使用，授权有效期 90 天，可随时续期或退出；设置中可查看账户余额。 |
| 🤖 **文本模型与 Agent** | 直接使用 GateMux 提供的文本模型列表，Agent 可读写画布，协助拆剧本、写分镜、组织素材。 |
| 🎬 **媒体生成** | 图片 Seedream 5.0 Flash、Seedream 5.5；视频 Seedance 2.0 Mini、Seedance 2.5、Wan 3.0；配音 DeepSeek TTS。生成前显示预估费用。 |
| 🖼️ **无限画布** | 剧本、角色、场景、镜头与视频片段以节点连线组织，支持多画布与素材库。 |
| 🧊 **白模预演** | 粘贴剧本搭建三维白模场景，排走位、排机位，导出预演小样与分镜。 |
| 🧰 **本地媒体工具** | 抠图、降噪、人声分离、语音转字幕、视频插帧等处理在本机运行。 |
| 🔌 **MCP 与扩展** | 外部 Coding 工具可通过 MCP 操作 gmcut；支持本地安装节点、工具与技能插件。 |
| 🌐 **多语言** | 界面支持 22 种语言。 |

**创作流程**：剧本分镜 → 角色与场景 → 白模预演 → 按镜头生成图片与视频 → 配音 → 剪辑导出。

## 下载安装

从 [GitHub Releases](https://github.com/emmelleai/gmcut/releases/latest) 下载对应系统的安装包：

| 系统 | 安装包 |
| --- | --- |
| Windows x64 | `gmcut-版本号-Setup.exe` |
| Windows ARM64 | `gmcut-版本号-win-arm64-Setup.exe` |
| macOS Apple 芯片（macOS 14 及以上） | `gmcut-版本号-macos-arm64.pkg` |
| macOS Intel（macOS 14 及以上） | `gmcut-版本号-macos-x64.pkg` |
| Linux x64（Debian / Ubuntu） | `gmcut-版本号-linux-x64.deb` |
| Linux ARM64（Debian / Ubuntu） | `gmcut-版本号-linux-arm64.deb` |

- **Windows**：双击安装包按提示安装。打开后闪退时，请先安装 [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)。
- **macOS**：双击 `.pkg` 安装，安装过程需要联网准备运行时，完成后从“应用程序”打开 gmcut。
- **Linux**：在下载目录执行 `sudo apt install ./gmcut-版本号-linux-架构.deb`，安装过程需要联网。

安装后可在「设置 → 关于」检查更新。

> [!NOTE]
> 当前安装包尚未进行代码签名。Windows 可能提示“未知发布者”，点击“更多信息 → 仍要运行”；macOS 首次打开被拦截时，前往“系统设置 → 隐私与安全性”，在 gmcut 的提示处选择“仍要打开”。

## 快速开始

1. 打开 gmcut，进入「设置 → GateMux 账号」，点击授权，在浏览器中确认。
2. 回到首页，新建或打开一个工作目录。
3. 在画布中添加剧本、角色、场景等节点，或直接让 Agent 帮你拆解剧本、生成分镜。
4. 在图片、视频或配音节点中选择 GateMux 模型生成内容。费用按 GateMux 实际计费，从账户余额扣除。

没有 GateMux 账号时，请先到 [gatemux.cn](https://gatemux.cn) 注册并充值。

## 从源码运行

需要 Git 和 [Bun](https://bun.sh)（版本见根目录 `package.json` 的 `packageManager`）。

```sh
git clone https://github.com/emmelleai/gmcut.git
cd gmcut
bun install
bun run dev:plugins
```

分别在两个终端启动业务 Server 与 Web，然后打开 `http://localhost:5173`：

```sh
bun run dev:server
```

```sh
bun run dev:web
```

桌面端开发、打包和平台准备见 [贡献指南](./CONTRIBUTING.md) 与 [开发与扩展指南](./docs/development.md)（后者沿用上游文档，其中的插件市场、Toonflow 账号等在线服务在 gmcut 中不提供）。

> [!IMPORTANT]
> 独立 Web 服务没有登录鉴权，设置与授权凭证全局共享，仅适合个人在本机或受保护的网络中使用，不要直接暴露到公网。

## 与 Toonflow 的关系

gmcut 是 Toonflow 的下游发行版，代码在 `gmcut` 分支，`master` 分支跟踪上游。与上游相比：

- 默认使用 GateMux 渠道，模型统一来自 GateMux；自定义模型供应商默认隐藏，可在开发者选项中开启。
- 不提供原 Toonflow 的账号与钱包、插件市场、作品社区和广告等在线服务；已安装的本地插件、MCP、FFmpeg 与本地模型照常可用。
- 使用独立的应用标识（`cn.gatemux.gmcut`）与协议（`gmcut://`），可以与 Toonflow 安装在同一台电脑上，数据互不影响。
- 匿名使用数据默认不上报。

与 GateMux 接入无关的问题（例如画布、节点、白模预演本身的缺陷），也欢迎直接反馈给 [Toonflow 上游](https://github.com/HBAI-Ltd/Toonflow-app/issues)。

## 参与贡献

欢迎提交 Issue 和 Pull Request，请先阅读 [贡献指南](./CONTRIBUTING.md) 与 [社区行为准则](./CODE_OF_CONDUCT.md)。

## 许可

gmcut 与 Toonflow 一样采用 [MIT 许可证](./LICENSE)，保留上游版权声明。gmcut 的名称与 Logo 不在 MIT 授权范围内，分发修改版本时请使用其他名称和标识。第三方依赖与素材遵循各自的许可。
