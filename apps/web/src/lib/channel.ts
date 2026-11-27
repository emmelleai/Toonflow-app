import { shallowRef } from "vue";
import type { ChannelCapabilities } from "@toonflow/server/channel";
import http from "@/lib/http";

// ACT: 默认按 Toonflow 渠道全部开放：连接的是不认识该接口的旧版或上游服务端（如设备互联）时，界面与原版保持一致。
export const channelCapabilities = shallowRef<ChannelCapabilities>({
  account: true, pluginMarket: true, community: true, advertisements: true, customProviders: true,
});

export async function loadChannelCapabilities() {
  try {
    const { capabilities } = await http<{ id: string; capabilities: ChannelCapabilities }>({ method: "GET", url: "/api/channel/capabilities" });
    channelCapabilities.value = capabilities;
  } catch {
    // 读取失败沿用默认值，不阻止应用启动。
  }
}
