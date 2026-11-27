import type { Channel, ChannelCapabilities } from "./types";

// 设计说明见 .agent/gatemuxContext.md：GateMux 版关闭原 Toonflow 平台的账号、钱包、插件市场、社区与广告，
// 模型改由 GateMux 授权后提供（后续阶段接入）。
export const gatemuxCapabilities: ChannelCapabilities = {
  account: false,
  pluginMarket: false,
  community: false,
  advertisements: false,
  customProviders: false,
  gatemuxAuth: true,
};

async function unsupported(): Promise<never> {
  throw Object.assign(new Error("当前渠道不提供该功能"), { status: 404 });
}

// ACT: 逐项列出而不用 Proxy 兜底：上游给 Channel 新增方法时这里会类型报错，合并时能及时发现并决定是否开放。
export class GateMux implements Channel {
  getCaptcha = unsupported;
  sendSmsCode = unsupported;
  register = unsupported;
  login = unsupported;
  forgotPassword = unsupported;
  getPlugins = unsupported;
  getPluginExistence = unsupported;
  toggleCollection = unsupported;
  getPluginUploadSignature = unsupported;
  uploadPlugin = unsupported;
  updatePlugin = unsupported;
  deletePlugin = unsupported;
  getPreviewData = unsupported;
  getUsageStatistics = unsupported;
  getTaskRecords = unsupported;
  getPointsConsumption = unsupported;
  getSubAccounts = unsupported;
  createSubAccount = unsupported;
  removeSubAccount = unsupported;
  getWalletOrders = unsupported;
  getWalletPlans = unsupported;
  getWalletPresentation = unsupported;
  getWalletActivity = unsupported;
  getWalletBonusBatches = unsupported;
  exchangeWalletCode = unsupported;
  createWalletPayment = unsupported;
  getWalletPaymentStatus = unsupported;
  getModelData = unsupported;
  getProviderSource = unsupported;
  getVendorSource = unsupported;
  getExploreProjects = unsupported;
  getExploreProject = unsupported;
  getExploreProcess = unsupported;
  getExploreDownload = unsupported;
  getExploreUploadSignature = unsupported;
  uploadExploreProject = unsupported;
  getSponsorList = unsupported;
  getAdvertisements = unsupported;
  // 内置供应商列表为空：自定义供应商入口默认隐藏，开发者选项打开时也不显示 Toonflow 的在线供应商。
  async getVendors() { return []; }
}
