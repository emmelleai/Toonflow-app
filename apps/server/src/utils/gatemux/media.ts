import { dirname, join } from "node:path";
import { mkdir, readFile, writeAtomic } from "@toonflow/file";
import conf from "@/utils/conf";
import { getChannelInfo } from "@/utils/channel";
import { getCredential } from "./auth";
// 供应商源码以文本随服务端打包，安装到数据目录后由宿主的媒体供应商机制加载。
import providerSource from "./mediaProvider.ts" with { type: "text" };

export const mediaProviderId = "gatemux";
const marker = "// gmcut builtin GateMux media provider\n";
const content = marker + (providerSource as unknown as string);

/**
 * GateMux 渠道下确保数据目录中安装了随应用发布的 GateMux 媒体供应商，版本变化时更新。
 * 用户自建的同名 gatemux.ts（没有内置标记）不覆盖。
 */
export async function ensureMediaProvider() {
  if (!getChannelInfo().capabilities.gatemuxAuth) return;
  const directory = join(dirname(conf.path), "providers");
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${mediaProviderId}.ts`);
  const current = await readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  if (current === content || (current !== undefined && !current.startsWith(marker))) return;
  await writeAtomic(path, content);
}

/** GateMux 渠道下未授权时隐藏 GateMux 媒体模型；其他渠道按用户自己的配置显示。 */
export function isMediaAvailable(providerId: string) {
  return providerId !== mediaProviderId || !getChannelInfo().capabilities.gatemuxAuth || !!getCredential();
}

/** 加载 GateMux 媒体供应商时注入授权凭证；凭证只在服务端，不写入设置。 */
export function withMediaCredential(providerId: string, config: Record<string, unknown>) {
  const credential = providerId === mediaProviderId ? getCredential() : undefined;
  return credential ? { ...config, apiKey: credential.pat } : config;
}
