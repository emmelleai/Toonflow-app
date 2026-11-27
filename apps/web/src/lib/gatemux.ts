import { shallowRef } from "vue";
import { ElMessage } from "element-plus";
import { invalidateNodeModels } from "@toonflow/nodes-scaffold/nodeAi";
import http from "@/lib/http";

// GateMux 轮询授权的前端状态：凭证只在服务端，前端只拿到授权状态与账号信息。
export type GatemuxStatus = { authorized: boolean; expired?: boolean; scopes?: string[]; expiresAt?: number | null; renewable?: boolean };
export type GatemuxAccount = { email: string | null; wallet: { currency: string; balance: string } | null };

export const gatemuxStatus = shallowRef<GatemuxStatus>({ authorized: false });
export const gatemuxAccount = shallowRef<GatemuxAccount | null>(null);
/** 正在等待用户在浏览器中确认的授权。 */
export const gatemuxPending = shallowRef<{ flowId: string; verificationUrl: string } | null>(null);
let pollTimer: ReturnType<typeof setTimeout> | undefined;

export async function refreshGatemux() {
  gatemuxStatus.value = await http<GatemuxStatus>({ method: "GET", url: "/api/gatemux/auth/status" });
  if (gatemuxStatus.value.renewable) {
    // 续期失败不影响继续使用剩余有效期内的凭证，下次刷新再试。
    gatemuxStatus.value = await http<GatemuxStatus>({ method: "POST", url: "/api/gatemux/auth/renew" }).catch(() => gatemuxStatus.value);
  }
  if (!gatemuxStatus.value.authorized) {
    gatemuxAccount.value = null;
    return;
  }
  try {
    gatemuxAccount.value = await http<GatemuxAccount>({ method: "GET", url: "/api/gatemux/account" });
  } catch (error) {
    // 服务端在 401 时已清除凭证，这里同步状态。
    if ((error as { status?: number }).status === 401) {
      gatemuxStatus.value = { authorized: false };
      gatemuxAccount.value = null;
    }
    throw error;
  }
}

function stopPolling() {
  clearTimeout(pollTimer);
  pollTimer = undefined;
  gatemuxPending.value = null;
}

function schedulePoll(flowId: string, interval: number) {
  pollTimer = setTimeout(async () => {
    if (gatemuxPending.value?.flowId !== flowId) return;
    try {
      const { status } = await http<{ status: "pending" | "approved" | "expired" }>({ method: "POST", url: "/api/gatemux/auth/poll", data: { flowId } });
      if (gatemuxPending.value?.flowId !== flowId) return;
      if (status === "pending") return schedulePoll(flowId, interval);
      stopPolling();
      if (status === "expired") return void ElMessage.warning("授权已过期或未完成，请重新授权");
      ElMessage.success("GateMux 授权成功");
      // 授权后服务端会提供 GateMux 文本模型，刷新模型选项。
      invalidateNodeModels("language");
      await refreshGatemux();
    } catch (error) {
      if (gatemuxPending.value?.flowId !== flowId) return;
      stopPolling();
      ElMessage.error(error instanceof Error ? error.message : "GateMux 授权失败");
    }
  }, interval * 1000);
}

export async function startGatemuxLogin() {
  stopPolling();
  const { flowId, verificationUrl, interval } = await http<{ flowId: string; verificationUrl: string; interval: number }>({
    method: "POST", url: "/api/gatemux/auth/start",
  });
  gatemuxPending.value = { flowId, verificationUrl };
  window.open(verificationUrl, "_blank", "noopener,noreferrer");
  schedulePoll(flowId, interval);
}

export function cancelGatemuxLogin() {
  const flowId = gatemuxPending.value?.flowId;
  stopPolling();
  if (flowId) void http({ method: "POST", url: "/api/gatemux/auth/cancel", data: { flowId } }).catch(() => {});
}

export async function logoutGatemux() {
  const { revoked } = await http<{ revoked: boolean }>({ method: "POST", url: "/api/gatemux/auth/logout" });
  gatemuxStatus.value = { authorized: false };
  gatemuxAccount.value = null;
  invalidateNodeModels("language");
  return revoked;
}
