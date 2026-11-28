import { markMessages } from "@toonflow/i18n";
import type { updateSteps as upstreamSteps } from "./updateNotes";

// gmcut 使用独立的更新说明；上游 updateNotes.ts 保持原样，便于同步。
export const updateSteps = markMessages<typeof upstreamSteps>([
  {
    title: "gmcut 首个版本",
    sections: [
      {
        notes: [
          { label: "关于 gmcut", text: "gmcut 是 GateMux 生态的 AI 短剧与视频创作客户端，基于开源项目 Toonflow（MIT）构建。" },
        ],
      },
    ],
  },
  {
    title: "新增",
    sections: [
      {
        notes: [
          { label: "GateMux 账号", text: "在设置的「GateMux 账号」中点击授权，浏览器确认后即可使用，无需手动配置 API Key。授权有效期 90 天，可随时续期或退出。" },
          { label: "文本模型", text: "直接使用 GateMux 提供的模型列表，Agent 对话、剧本与分镜等节点均可选用。" },
          { label: "媒体模型", text: "内置 GateMux 媒体模型：图片 Seedream 5.0 Flash、Seedream 5.5；视频 Seedance 2.0 Mini、Seedance 2.5、Wan 3.0；配音 DeepSeek TTS。" },
          { label: "费用与余额", text: "生成前显示预估费用，设置中可查看 GateMux 账户余额。费用按 GateMux 实际计费结算。" },
          { label: "桌面客户端", text: "提供 Windows（x64、ARM64）、macOS（Apple 芯片、Intel）与 Linux（x64、ARM64）客户端，通过 GitHub Releases 发布与更新。" },
        ],
      },
    ],
  },
  {
    title: "说明",
    sections: [
      {
        notes: [
          { label: "在线服务", text: "原 Toonflow 的账号与钱包、插件市场、作品社区等在线服务在 gmcut 中不提供。已安装的本地插件、MCP、FFmpeg 与本地模型照常可用。" },
          { label: "自定义供应商", text: "自定义模型供应商默认隐藏，可在开发者选项中开启。" },
          { label: "使用数据", text: "匿名使用数据默认不上报。" },
          { label: "安装包签名", text: "当前安装包尚未签名，首次打开时系统可能提示安全警告，请在系统设置中允许打开。" },
        ],
      },
    ],
  },
]);
