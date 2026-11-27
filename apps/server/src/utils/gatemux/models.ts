import conf from "@/utils/conf";
import { apiUrl, clearCredential, getCredential, request } from "./auth";

// GateMux 文本模型：授权后作为账号供应商注入文本模型列表，供 Agent 与文本节点使用。
// pat 只在服务端拼进供应商配置，模型列表接口只返回模型 ID 与名称。

export type GatemuxModelCache = { fetchedAt: number; models: { id: string; label: string; contextWindow?: number; maxOutputTokens?: number }[] };

export const providerId = "gatemux";
const cacheLifetime = 10 * 60_000;
let refreshing: Promise<void> | undefined;

/** 已授权时返回 GateMux 文本供应商；模型列表来自缓存，由 refreshModels 更新。 */
export function getProvider() {
  const credential = getCredential();
  if (!credential) return;
  return {
    id: providerId,
    label: "GateMux",
    apiUrl: `${apiUrl}/v1`,
    apiKey: credential.pat,
    protocol: "openai-completions" as const,
    models: conf.get("gatemuxModels", null)?.models ?? [],
  };
}

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

async function fetchModels() {
  const credential = getCredential();
  if (!credential) return;
  const { status, data } = await request("/v1/models", { method: "GET", pat: credential.pat });
  if (status === 401) {
    clearCredential();
    return;
  }
  const items = (data as { data?: unknown } | null)?.data;
  if (status !== 200 || !Array.isArray(items)) throw Object.assign(new Error(`读取 GateMux 模型列表失败（${status}）`), { status: 502 });
  // 只取支持 OpenAI Chat Completions 协议的对话模型；图片、视频、语音模型在媒体供应商中接入。
  const models = items.flatMap((item: { id?: unknown; name?: unknown; protocols?: unknown; contextWindow?: unknown; maxTokens?: unknown }) => {
    if (typeof item?.id !== "string" || !item.id.trim()) return [];
    if (!Array.isArray(item.protocols) || !item.protocols.includes("openai-completions")) return [];
    const contextWindow = positiveInteger(item.contextWindow);
    const maxOutputTokens = positiveInteger(item.maxTokens);
    return [{
      id: item.id,
      label: typeof item.name === "string" && item.name.trim() ? item.name.trim() : item.id,
      // 上下文与输出上限需成对提供才会被采用，否则沿用模型目录的默认推断。
      ...(contextWindow && maxOutputTokens ? { contextWindow, maxOutputTokens } : {}),
    }];
  });
  conf.set("gatemuxModels", { fetchedAt: Date.now(), models });
}

/**
 * 刷新模型缓存。已有缓存时后台刷新、不阻塞调用方；首次没有缓存时等待结果。
 * ACT: 缓存 10 分钟，按调用触发刷新，不做后台定时轮询。
 */
export async function refreshModels() {
  if (!getCredential()) return;
  const cache = conf.get("gatemuxModels", null);
  if (cache && Date.now() - cache.fetchedAt < cacheLifetime) return;
  refreshing ??= fetchModels().finally(() => { refreshing = undefined; });
  if (cache?.models.length) {
    refreshing.catch(error => console.error(error));
    return;
  }
  await refreshing;
}
