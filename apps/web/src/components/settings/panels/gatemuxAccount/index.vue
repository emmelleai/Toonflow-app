<template>
  <div class="gatemuxAccount">
    <template v-if="gatemuxStatus.authorized">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="账号">{{ gatemuxAccount?.email || "—" }}</el-descriptions-item>
        <el-descriptions-item label="余额">{{ balanceText }}</el-descriptions-item>
        <el-descriptions-item label="授权有效期至">{{ expiresText }}</el-descriptions-item>
      </el-descriptions>
      <p class="description">模型调用费用从你的 GateMux 余额扣除。可在 GateMux 控制台查看用量、调整本应用的每月消费上限或撤销授权。</p>
      <div class="actions">
        <el-button :loading="refreshing" @click="refresh">刷新</el-button>
        <el-button :loading="loggingOut" @click="logout">退出授权</el-button>
      </div>
    </template>
    <template v-else-if="gatemuxPending">
      <p class="description">请在浏览器中登录 GateMux 并确认授权，完成后这里会自动更新。浏览器没有自动打开时，点击下方按钮。</p>
      <div class="actions">
        <el-button tag="a" type="primary" :href="gatemuxPending.verificationUrl" target="_blank" rel="noopener noreferrer">打开授权页面</el-button>
        <el-button @click="cancelGatemuxLogin">取消</el-button>
      </div>
    </template>
    <template v-else>
      <p class="description">
        {{ gatemuxStatus.expired ? "GateMux 授权已过期，请重新授权。" : "使用 GateMux 账号授权后，即可使用 GateMux 提供的文本、图片、视频和语音模型，无需配置 API Key，费用从你的 GateMux 余额扣除。" }}
      </p>
      <div class="actions">
        <el-button type="primary" :loading="starting" @click="login">使用 GateMux 授权</el-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { locale } from "@toonflow/i18n/vue";
import { cancelGatemuxLogin, gatemuxAccount, gatemuxPending, gatemuxStatus, logoutGatemux, refreshGatemux, startGatemuxLogin } from "@/lib/gatemux";

const starting = ref(false);
const refreshing = ref(false);
const loggingOut = ref(false);

const balanceText = computed(() => {
  const wallet = gatemuxAccount.value?.wallet;
  if (!wallet) return "—";
  try {
    return new Intl.NumberFormat(locale.value, { style: "currency", currency: wallet.currency }).format(Number(wallet.balance));
  } catch {
    return `${wallet.balance} ${wallet.currency}`;
  }
});
const expiresText = computed(() => {
  const expiresAt = gatemuxStatus.value.expiresAt;
  return expiresAt ? new Date(expiresAt).toLocaleDateString(locale.value) : "—";
});

function showError(error: unknown, fallback: string) {
  ElMessage.error(error instanceof Error ? error.message : fallback);
}

async function refresh() {
  refreshing.value = true;
  try { await refreshGatemux(); } catch (error) { showError(error, "读取 GateMux 账号失败"); } finally { refreshing.value = false; }
}

async function login() {
  starting.value = true;
  try { await startGatemuxLogin(); } catch (error) { showError(error, "发起 GateMux 授权失败"); } finally { starting.value = false; }
}

async function logout() {
  try {
    await ElMessageBox.confirm("退出后需要重新授权才能使用 GateMux 模型。", "退出 GateMux 授权", { type: "warning", confirmButtonText: "退出", cancelButtonText: "取消" });
  } catch {
    return;
  }
  loggingOut.value = true;
  try {
    const revoked = await logoutGatemux();
    if (revoked) ElMessage.success("已退出 GateMux 授权");
    else ElMessage.warning("已删除本机授权，但远端撤销失败，可在 GateMux 控制台的设备页撤销");
  } catch (error) {
    showError(error, "退出 GateMux 授权失败");
  } finally {
    loggingOut.value = false;
  }
}

onMounted(() => {
  if (!gatemuxPending.value) void refresh();
});
</script>

<style lang="scss" scoped>
.gatemuxAccount {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0 4px 8px;

  .description {
    margin: 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.6;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .el-button { margin-left: 0; }
  }
}
</style>
