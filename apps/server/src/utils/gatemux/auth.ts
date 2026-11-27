import { createHash, randomBytes, randomUUID } from "node:crypto";
import conf from "@/utils/conf";
import { getChannelInfo } from "@/utils/channel";

// GateMux 轮询授权（oauth-polling）参考实现，说明见 .agent/gatemuxContext.md。
// 凭证 pat 只保存在服务端配置的独立项中，不随设置下发前端，只放在 Authorization 请求头里。

export type GatemuxCredential = { pat: string; scopes: string[]; expiresAt: number | null; appId: string };
type Flow = { code: string; verifier: string; interval: number; expiresAt: number; polledAt: number };

const apiUrl = "https://rest.gatemux.cn";
// app_id 是公开标识；构建或启动时可用 GATEMUX_APP_ID 切换测试应用与正式应用。
const clientId = process.env.GATEMUX_APP_ID?.trim() || "app_6192bdd29fa6870a";
const scopes = ["models:read", "responses:create", "media:create", "files:write", "account:read", "billing:read"];
const flowLifetime = 10 * 60_000;
const renewWindow = 30 * 86400_000;
// ACT: 待批准的授权流程只保存在本进程内存中，服务重启后需重新发起；桌面单进程足够，多实例部署需改为共享存储。
const flows = new Map<string, Flow>();

const errorMessages: Record<string, string> = {
  invalid_client: "GateMux 应用 ID 无效",
  invalid_scope: "GateMux 应用未开通所需权限，请检查应用的权限设置",
  app_unavailable: "GateMux 应用当前不可用（已停用、下架或正在审核）",
  rate_limit_exceeded: "授权请求过于频繁，请稍后再试",
  pending_cap: "待确认的授权过多，请稍后再试",
  server_busy: "GateMux 服务繁忙，请稍后再试",
  credential_invalid: "GateMux 授权已失效，请重新授权",
  credential_expired: "GateMux 授权已过期，请重新授权",
  scope_denied: "当前授权缺少所需权限，请重新授权",
};

function fail(message: string, status: number): never {
  throw Object.assign(new Error(message), { status });
}

function upstreamError(status: number, data: unknown): never {
  const code = (data as { error?: { code?: unknown } } | null)?.error?.code;
  const message = typeof code === "string" ? errorMessages[code] : undefined;
  if (message) fail(message, status === 401 ? 401 : 502);
  if (status === 404) fail("GateMux 开放平台接口不可用，请确认应用已开通", 502);
  if (status === 429) fail(errorMessages.rate_limit_exceeded!, 429);
  fail(`GateMux 请求失败（${status}${typeof code === "string" ? `，${code}` : ""}）`, 502);
}

async function request(path: string, options: { method?: "GET" | "POST"; body?: unknown; pat?: string; signal?: AbortSignal } = {}) {
  const response = await fetch(apiUrl + path, {
    method: options.method ?? "POST",
    headers: {
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(options.pat ? { Authorization: `Key ${options.pat}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal ?? AbortSignal.timeout(20_000),
  });
  return { status: response.status, data: await response.json().catch(() => null) as unknown };
}

export function assertEnabled() {
  if (!getChannelInfo().capabilities.gatemuxAuth) fail("当前渠道未启用 GateMux 授权", 404);
}

function deviceName() {
  const system = { darwin: "macOS", win32: "Windows", linux: "Linux" }[process.platform as string] ?? process.platform;
  // 不使用主机名，避免把本机名称发送给外部服务。
  return `gmcut（${system}）`;
}

function readCredential() {
  return conf.get("gatemuxCredential", null);
}

function clearCredential() {
  conf.delete("gatemuxCredential");
}

function parseCredential(data: unknown): GatemuxCredential {
  const value = data as { pat?: unknown; scopes?: unknown; expires_at?: unknown; app_id?: unknown } | null;
  if (typeof value?.pat !== "string" || !value.pat.trim()) fail("GateMux 授权响应缺少凭证", 502);
  const scopeList = Array.isArray(value.scopes) ? value.scopes : typeof value.scopes === "string" ? value.scopes.split(/\s+/) : [];
  // 文档约定时间为 UTC Unix 秒；兼容毫秒与 ISO 字符串。
  const raw = value.expires_at;
  const expiresAt = typeof raw === "number" ? (raw > 1e12 ? raw : raw * 1000) : typeof raw === "string" && !Number.isNaN(Date.parse(raw)) ? Date.parse(raw) : null;
  return {
    pat: value.pat.trim(),
    scopes: scopeList.filter((item): item is string => typeof item === "string" && !!item),
    expiresAt,
    appId: typeof value.app_id === "string" ? value.app_id : clientId,
  };
}

function pruneFlows() {
  const now = Date.now();
  for (const [id, flow] of flows) if (flow.expiresAt <= now) flows.delete(id);
}

export async function startAuthorization(signal?: AbortSignal) {
  pruneFlows();
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const { status, data } = await request("/v1/oauth/authorize", {
    body: { client_id: clientId, code_challenge: challenge, code_challenge_method: "S256", scope: scopes, device_name: deviceName() },
    signal,
  });
  if (status !== 200) upstreamError(status, data);
  const value = data as { code?: unknown; verification_url?: unknown; interval?: unknown } | null;
  const url = typeof value?.verification_url === "string" && URL.canParse(value.verification_url) ? new URL(value.verification_url) : undefined;
  // 只打开 GateMux 自己的 HTTPS 页面，避免把任意地址交给浏览器。
  if (typeof value?.code !== "string" || !url || url.protocol !== "https:" || !(url.hostname === "gatemux.cn" || url.hostname.endsWith(".gatemux.cn"))) {
    fail("GateMux 授权响应格式不正确", 502);
  }
  const interval = typeof value.interval === "number" && Number.isFinite(value.interval) ? Math.min(60, Math.max(2, value.interval)) : 5;
  const flowId = randomUUID();
  flows.set(flowId, { code: value.code, verifier, interval, expiresAt: Date.now() + flowLifetime, polledAt: 0 });
  return { flowId, verificationUrl: url.href, interval, expiresIn: flowLifetime / 1000 };
}

export async function pollAuthorization(flowId: string) {
  const flow = flows.get(flowId);
  if (!flow || flow.expiresAt <= Date.now()) {
    flows.delete(flowId);
    return { status: "expired" as const };
  }
  // 按 GateMux 建议的间隔轮询；前端提前请求时直接返回等待中，不额外请求上游。
  if (Date.now() - flow.polledAt < flow.interval * 1000 - 500) return { status: "pending" as const };
  flow.polledAt = Date.now();
  // 不跟随前端请求取消：批准后 pat 只返回一次，中途放弃会丢失凭证。
  const { status, data } = await request("/v1/oauth/token", { body: { code: flow.code, code_verifier: flow.verifier } });
  if (status === 428) return { status: "pending" as const };
  flows.delete(flowId);
  if (status !== 200) {
    if ((data as { error?: { code?: unknown } } | null)?.error?.code === "invalid_grant") return { status: "expired" as const };
    upstreamError(status, data);
  }
  conf.set("gatemuxCredential", parseCredential(data));
  return { status: "approved" as const };
}

export function cancelAuthorization(flowId: string) {
  flows.delete(flowId);
}

export function getStatus() {
  const credential = readCredential();
  if (!credential) return { authorized: false as const };
  const now = Date.now();
  const expired = credential.expiresAt !== null && credential.expiresAt <= now;
  return {
    authorized: !expired,
    expired,
    scopes: credential.scopes,
    expiresAt: credential.expiresAt,
    renewable: !expired && credential.expiresAt !== null && credential.expiresAt - now <= renewWindow,
  };
}

export async function renewCredential(signal?: AbortSignal) {
  const credential = readCredential();
  if (!credential) fail("尚未授权 GateMux", 401);
  const { status, data } = await request("/v1/oauth/renew", { pat: credential.pat, signal });
  const code = (data as { error?: { code?: unknown } } | null)?.error?.code;
  if (status === 200) {
    const renewed = parseCredential(data);
    // 续期不扩大权限；响应未带 scopes 时沿用原授权范围。
    conf.set("gatemuxCredential", { ...renewed, scopes: renewed.scopes.length ? renewed.scopes : credential.scopes });
    return getStatus();
  }
  if (code === "renew_too_early") return getStatus();
  if (status === 401 || code === "credential_expired") clearCredential();
  upstreamError(status, data);
}

export async function logout() {
  const credential = readCredential();
  if (!credential) return { revoked: false };
  // 先撤销远端凭证；网络失败也删除本地凭证，用户仍可在 GateMux 控制台的设备页撤销。
  const revoked = await request("/v1/oauth/revoke", { body: { token: credential.pat } })
    .then(({ status }) => status === 200, () => false);
  clearCredential();
  return { revoked };
}

export async function getAccount(signal?: AbortSignal) {
  const credential = readCredential();
  if (!credential) fail("尚未授权 GateMux", 401);
  const { status, data } = await request("/v1/account/me", { method: "GET", pat: credential.pat, signal });
  if (status === 401) clearCredential();
  if (status !== 200) upstreamError(status, data);
  const value = data as { email_masked?: unknown; wallet?: { currency?: unknown; balance?: unknown } | null } | null;
  const wallet = value?.wallet && typeof value.wallet.currency === "string" && typeof value.wallet.balance === "string"
    ? { currency: value.wallet.currency, balance: value.wallet.balance }
    : null;
  return { email: typeof value?.email_masked === "string" ? value.email_masked : null, wallet };
}
