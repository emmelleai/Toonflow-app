import { Toonflow } from "./toonflow";
import { GateMux, gatemuxCapabilities } from "./gatemux";
import type { Channel, ChannelCapabilities } from "./types";

const fullCapabilities: ChannelCapabilities = { account: true, pluginMarket: true, community: true, advertisements: true, customProviders: true, gatemuxAuth: false };
const channels = new Map<string, { channel: Channel; capabilities: ChannelCapabilities }>([
  ["toonflow", { channel: new Toonflow(), capabilities: fullCapabilities }],
  ["gatemux", { channel: new GateMux(), capabilities: gatemuxCapabilities }],
]);

function getEntry() {
  // gmcut 发行版默认使用 GateMux 渠道；设置 TOONFLOW_CHANNEL=toonflow 可回到上游行为。
  const id = process.env.TOONFLOW_CHANNEL?.trim() || "gatemux";
  const entry = channels.get(id);
  if (!entry) throw Object.assign(new Error("渠道未配置，请检查 TOONFLOW_CHANNEL"), { status: 503 });
  return { id, ...entry };
}

export function getChannel(): Channel {
  return getEntry().channel;
}

export function getChannelInfo() {
  const { id, capabilities } = getEntry();
  return { id, capabilities };
}
