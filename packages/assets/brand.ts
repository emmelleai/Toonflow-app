// 品牌与分发配置（gmcut 发行版）：产品名称、官网、仓库、更新源与遥测地址统一从这里读取，
// 各端不再写死上游 Toonflow 的地址。说明见 .agent/gatemuxContext.md。
const repository = "https://github.com/emmelleai/Toonflow-app";

export default {
  name: "gmcut",
  website: "https://gmcut.gatemux.cn",
  repository,
  repositoryName: "emmelleai/Toonflow-app",
  releasesUrl: `${repository}/releases/latest`,
  // 桌面更新源：官方源暂与 GitHub 源相同，都使用 GitHub Releases；以后有国内镜像时只改 officialUpdateUrl。
  officialUpdateUrl: `${repository}/releases/latest/download`,
  githubUpdateUrl: `${repository}/releases/latest/download`,
  // 匿名遥测上报地址；留空时不上报。
  telemetryUrl: "",
};
