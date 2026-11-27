<template>
  <div class="modelLoginGuide">
    <span v-if="channelCapabilities.gatemuxAuth">授权 GateMux 账号后即可使用 GateMux 模型，无需手动配置 API Key。</span>
    <span v-else>登录 Toonflow 后即可使用官方模型，无需手动配置 API Key。</span>
    <el-button type="primary" size="small" @click.stop="openLogin">{{ channelCapabilities.gatemuxAuth ? "前往授权" : "前往登录" }}</el-button>
  </div>
</template>

<script setup lang="ts">
import { inject } from "vue";
import { channelCapabilities } from "@/lib/channel";

const emit = defineEmits<{ login: [] }>();
const openSettingsPanel = inject<(id: string) => void>("openSettingsPanel");

function openLogin() {
  emit("login");
  openSettingsPanel?.(channelCapabilities.value.gatemuxAuth ? "gatemuxAccount" : "account");
}
</script>

<style lang="scss" scoped>
.modelLoginGuide {
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 16px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
  white-space: normal;
}
</style>
