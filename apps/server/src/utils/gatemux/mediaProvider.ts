// GateMux 媒体供应商：图片、视频走 fal 队列（提交 → 轮询 → 取结果，可断点恢复），语音走 /v1/audio/speech。
// 这是标准的 Toonflow 媒体供应商源码，可单独安装：在设置中填写 GateMux API Key 即可使用；
// gmcut 中由服务端在加载时注入 GateMux 授权凭证，不需要填写。参数以 https://rest.gatemux.cn/catalog/models/{模型 ID} 为准。
import type { Provider, ProviderTaskData, ProviderTools } from "@toonflow/providers";

type Input = { type: "url"; url: string; mimeType?: string } | { type: "base64"; data: string; mimeType: string } | { type: "binary"; data: Uint8Array; mimeType: string };
type Context = { tool: ProviderTools; config: Record<string, unknown>; signal?: AbortSignal; saveTaskData?: (data: ProviderTaskData) => Promise<void> };
type Asset = Input & { mediaType: "image" | "video" | "audio" };

const baseUrl = "https://rest.gatemux.cn";
const tierPixels: Record<string, number> = { "1K": 1024, "1.5K": 1536, "2K": 2048 };
const videoPixels: Record<string, [number, number]> = { "480p": [854, 480], "720p": [1280, 720], "1080p": [1920, 1080] };
const seedanceRatios = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];

function apiKey(context: Context) {
  const key = typeof context.config.apiKey === "string" ? context.config.apiKey.trim() : "";
  if (!key) throw new Error("请先授权 GateMux 账号或填写 GateMux API Key");
  return key;
}

const errorHints: Record<string, string> = {
  insufficient_balance: "GateMux 余额不足，请充值后重试",
  budget_exceeded: "已达到消费上限，可在 GateMux 控制台调整本应用的每月消费上限",
  credential_invalid: "GateMux 授权已失效，请重新授权",
  scope_denied: "当前授权缺少媒体生成权限，请重新授权",
  model_not_allowed: "该模型未在应用中开放",
  moderation_blocked: "内容未通过审核，请修改提示词或参考素材",
};

async function request(context: Context, url: string, init: { method?: string; body?: unknown } = {}) {
  // 只把凭证发给 GateMux 自己的地址。
  if (new URL(url).origin !== baseUrl) throw new Error("GateMux 返回了非预期的任务地址");
  const response = await context.tool.fetch(url, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: { Authorization: `Key ${apiKey(context)}`, ...(init.body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (response.ok) return response;
  const text = await response.text().catch(() => "");
  let body: { error?: unknown; reason?: unknown; message?: unknown; detail?: unknown } | null = null;
  try { body = JSON.parse(text); } catch { /* 非 JSON 错误正文按原文显示。 */ }
  const error = body?.error as { code?: unknown; message?: unknown } | string | undefined;
  const code = typeof error === "string" ? error : error?.code;
  const hint = typeof code === "string" ? errorHints[code] : undefined;
  // 优先显示 GateMux 给出的具体原因（reason / message / detail），没有时显示原始响应，便于排查参数问题。
  const reason = [body?.reason, body?.message, typeof error === "object" ? error?.message : undefined, body?.detail]
    .map(item => typeof item === "string" ? item : item === undefined ? "" : JSON.stringify(item)).find(Boolean);
  const detail = [typeof code === "string" ? code : "", reason ?? text.slice(0, 500)].filter(Boolean).join("：");
  throw new Error(hint ?? `GateMux 请求失败（${response.status}）${detail ? `：${detail}` : ""}`);
}

/** 本地素材以 data URI 直接传给模型，网络素材保留原地址（Seedream 支持 data URI）。 */
function inputUrl(input: Input) {
  if (input.type === "url") return input.url;
  const data = input.type === "base64" ? input.data : Buffer.from(input.data).toString("base64");
  return `data:${input.mimeType};base64,${data}`;
}

/**
 * 视频模型要求参考素材为公开 HTTPS 地址：本地素材先上传到 GateMux 存储（POST /storage/upload，multipart，单个不超过 20 MiB）。
 * 运行环境没有 FormData，这里手工拼 multipart 正文。
 */
async function publicUrl(context: Context, input: Input) {
  if (input.type === "url" && input.url.startsWith("https://")) return input.url;
  const bytes = input.type === "base64" ? Buffer.from(input.data, "base64")
    : input.type === "binary" ? Buffer.from(input.data)
      : Buffer.from(await (await context.tool.fetch(input.url)).arrayBuffer());
  if (bytes.byteLength > 20 * 1024 * 1024) throw new Error("参考素材超过 20 MB，请压缩后重试");
  const mimeType = input.mimeType ?? "application/octet-stream";
  const boundary = `gmcut${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const extension = mimeType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "bin";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="reference.${extension}"\r\nContent-Type: ${mimeType}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const response = await context.tool.fetch(`${baseUrl}/storage/upload`, {
    method: "POST",
    headers: { Authorization: `Key ${apiKey(context)}`, "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GateMux 上传参考素材失败（${response.status}）：${text.slice(0, 300)}`);
  let value: { url?: unknown; file_url?: unknown; access_url?: unknown; data?: { url?: unknown } } = {};
  try { value = JSON.parse(text); } catch { /* 下方统一报错。 */ }
  const url = [value.url, value.file_url, value.access_url, value.data?.url].find((item): item is string => typeof item === "string" && item.startsWith("https://"));
  if (!url) throw new Error(`GateMux 上传响应中没有可用地址：${text.slice(0, 300)}`);
  return url;
}

function wait(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, milliseconds);
    const abort = () => { clearTimeout(timer); reject(signal!.reason); };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

/** 提交到 fal 队列，保存可恢复的任务地址后等待结果。 */
async function submit(context: Context, model: string, mediaType: "image" | "video", body: Record<string, unknown>) {
  const response = await request(context, `${baseUrl}/${model}`, { body });
  const task = await response.json() as { request_id?: unknown; status_url?: unknown; response_url?: unknown };
  if (typeof task.request_id !== "string" || typeof task.status_url !== "string" || typeof task.response_url !== "string") {
    throw new Error("GateMux 任务提交响应格式不正确");
  }
  const data = { model, mediaType, requestId: task.request_id, statusUrl: task.status_url, responseUrl: task.response_url };
  await context.saveTaskData?.(data);
  return poll(context, data);
}

async function poll(context: Context, task: { mediaType: string; statusUrl: string; responseUrl: string }) {
  const interval = task.mediaType === "video" ? 5000 : 2000;
  // ACT: 最长等待 2 小时；超过后报错，任务仍可能在 GateMux 侧完成，可在控制台查看。
  for (const deadline = Date.now() + 2 * 3600_000; Date.now() < deadline;) {
    const status = await (await request(context, task.statusUrl)).json() as { status?: unknown; error?: unknown; error_type?: unknown };
    if (status.status === "COMPLETED") return result(context, task);
    if (status.status !== "IN_QUEUE" && status.status !== "IN_PROGRESS") {
      throw new Error(`GateMux 任务失败：${context.tool.errorMessage(status.error ?? status.error_type ?? status.status) || "未知原因"}`);
    }
    await wait(interval, context.signal);
  }
  throw new Error("GateMux 任务等待超时，可在 GateMux 控制台查看任务结果");
}

async function result(context: Context, task: { mediaType: string; responseUrl: string }): Promise<Asset[]> {
  const value = await (await request(context, task.responseUrl)).json() as {
    images?: { url?: unknown; content_type?: unknown }[]; video?: { url?: unknown; content_type?: unknown }; error?: unknown; error_type?: unknown;
  };
  const files = task.mediaType === "video" ? (value.video ? [value.video] : []) : value.images ?? [];
  const assets = files.flatMap(file => typeof file.url === "string" ? [{
    type: "url" as const, url: file.url, mediaType: task.mediaType as "image" | "video",
    ...(typeof file.content_type === "string" ? { mimeType: file.content_type } : {}),
  }] : []);
  // 结果地址很快过期，由宿主在返回后立即下载保存。
  if (!assets.length) throw new Error(`GateMux 未返回生成结果：${context.tool.errorMessage(value.error ?? value.error_type) || "未知原因"}`);
  return assets;
}

/** 把提示词中的 {{ref N}} 换成模型能识别的参考称呼；没有引用顺序时按图片顺序对应。 */
function referencePrompt(prompt: string, order: { type: string; index?: number }[] | undefined, imageNumber: (index: number) => number | undefined) {
  return prompt.replace(/\{\{ref (\d+)\}\}/g, (match, value: string) => {
    const reference = order ? order[Number(value) - 1] : { type: "image", index: Number(value) - 1 };
    if (reference?.type === "firstFrame") return "首帧";
    if (reference?.type === "lastFrame") return "尾帧";
    const number = reference?.type === "image" && reference.index !== undefined ? imageNumber(reference.index) : undefined;
    return number ? `[图${number}]` : match;
  });
}

function imageSize(size: string | undefined, ratio: string | undefined) {
  const tier = size && tierPixels[size] ? size : "2K";
  const match = ratio?.match(/^(\d+):(\d+)$/);
  if (!match) return tier;
  // 按档位面积与画面比例换算宽高，取 16 的倍数。
  const area = tierPixels[tier]! ** 2;
  const width = Math.round(Math.sqrt(area * Number(match[1]) / Number(match[2])) / 16) * 16;
  return `${width}x${Math.round(area / width / 16) * 16}`;
}

function catalogPrice(pricing: Record<string, unknown>, key: string, option?: string) {
  const table = pricing[`${key}_by_resolution`];
  if (option && table && typeof table === "object") {
    const entry = Object.entries(table).find(([name]) => name.toLowerCase() === option.toLowerCase());
    if (entry && typeof entry[1] === "number") return entry[1];
  }
  return typeof pricing[key] === "number" ? pricing[key] as number : undefined;
}

export default {
  id: "gatemux",
  label: "GateMux",
  version: "1.0.0",
  readme: "GateMux 图片、视频与语音模型。gmcut 中授权 GateMux 账号后自动使用；在其他 Toonflow 中使用时填写 GateMux API Key。费用从 GateMux 余额扣除。",
  rules: [{ type: "input", field: "apiKey", title: "API Key", value: "", props: { type: "password", showPassword: true, placeholder: "sk-gatemux-…" } }],
  models: [
    { id: "gatemux/doubao-seedream-5-0-flash-260915", label: "Seedream 5.0 Flash", type: "image", mode: ["text", "singleImage", "multiReference"], imageSizes: ["2K", "1.5K", "1K"], imageRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"] },
    { id: "gatemux/doubao-seedream-5-5-261028", label: "Seedream 5.5", type: "image", mode: ["text", "singleImage", "multiReference"], imageSizes: ["2K", "1.5K", "1K"], imageRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"] },
    { id: "gatemux/doubao-seedance-2-0-mini-260615", label: "Seedance 2.0 Mini", type: "video", mode: ["text", "endFrameOptional", ["imageReference:9"]], audio: "optional", durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["480p", "720p"] }] },
    { id: "gatemux/doubao-seedance-2-5-260628", label: "Seedance 2.5", type: "video", mode: ["text", "endFrameOptional", ["imageReference:9"]], audio: "optional", durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30], resolution: ["480p", "720p", "1080p"] }] },
    { id: "gatemux/wan3.0-video", label: "Wan 3.0", type: "video", mode: ["text", "endFrameOptional", ["imageReference:9"]], audio: "optional", durationResolutionMap: [{ duration: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30], resolution: ["480P", "720P", "1080P"] }] },
    { id: "gatemux/deepseek-tts", label: "DeepSeek TTS", type: "audio", voices: [{ title: "Stella（女声）", voice: "stella" }, { title: "Tide（男声）", voice: "tide" }] },
  ],

  async generateImage(request) {
    const images = request.images ?? [];
    if (images.length > 10) throw new Error("Seedream 最多支持 10 张参考图");
    return submit(this, request.model, "image", {
      prompt: referencePrompt(request.prompt, undefined, index => index < images.length ? index + 1 : undefined),
      n: 1,
      size: imageSize(request.size, request.ratio),
      output_format: "png",
      watermark: false,
      ...(images.length ? { image_urls: images.map(inputUrl) } : {}),
    });
  },

  async generateVideo(request) {
    const references = request.images ?? [];
    if (references.length > 9) throw new Error("最多支持 9 张参考图");
    const order = (request as { referenceOrder?: { type: string; index?: number }[] }).referenceOrder;
    const prompt = referencePrompt(request.prompt, order, index => index < references.length ? index + 1 : undefined);
    const ratio = request.ratio && seedanceRatios.includes(request.ratio) ? request.ratio : "adaptive";
    const duration = request.duration ? Math.round(request.duration) : 5;
    // 视频模型只接受公开 HTTPS 地址，参考素材逐个上传，避免同时上传过多大文件。
    const firstFrame = request.firstFrame ? await publicUrl(this, request.firstFrame) : undefined;
    const lastFrame = request.lastFrame ? await publicUrl(this, request.lastFrame) : undefined;
    const referenceUrls: string[] = [];
    for (const image of references) referenceUrls.push(await publicUrl(this, image));
    if (request.model === "gatemux/wan3.0-video") {
      const media = [
        ...(firstFrame ? [{ type: "first_frame", url: firstFrame }] : []),
        ...(lastFrame ? [{ type: "last_frame", url: lastFrame }] : []),
        ...referenceUrls.map(url => ({ type: "reference_image", url })),
      ];
      return submit(this, request.model, "video", {
        prompt, duration, resolution: request.resolution ?? "720P", ratio,
        ...(request.generateAudio === undefined ? {} : { audio: request.generateAudio }),
        ...(media.length ? { media } : {}),
      });
    }
    const content = [
      { type: "text", text: prompt },
      ...(firstFrame ? [{ type: "image_url", image_url: { url: firstFrame }, role: "first_frame" }] : []),
      ...(lastFrame ? [{ type: "image_url", image_url: { url: lastFrame }, role: "last_frame" }] : []),
      ...referenceUrls.map(url => ({ type: "image_url", image_url: { url }, role: "reference_image" })),
    ];
    return submit(this, request.model, "video", {
      content, duration, resolution: request.resolution ?? "720p",
      // 首尾帧模式按首帧比例生成。
      ratio: request.firstFrame ? "adaptive" : ratio,
      watermark: false,
      ...(request.generateAudio === undefined ? {} : { generate_audio: request.generateAudio }),
    });
  },

  async generateAudio(request) {
    const input = (request.text ?? request.prompt ?? "").trim();
    if (!input) throw new Error("请输入要朗读的文本");
    if (input.length > 5000) throw new Error("单次朗读文本不能超过 5000 字");
    const response = await requestSpeech(this, request.model, input, request.voice ?? "stella");
    return [{ type: "binary", data: new Uint8Array(await response.arrayBuffer()), mimeType: "audio/mpeg", mediaType: "audio" }];
  },

  async resumeTask(data) {
    if (typeof data.statusUrl !== "string" || typeof data.responseUrl !== "string" || typeof data.mediaType !== "string") {
      throw new Error("GateMux 任务记录不完整，无法恢复");
    }
    return poll(this, { mediaType: data.mediaType, statusUrl: data.statusUrl, responseUrl: data.responseUrl });
  },

  async getPrice(request) {
    const response = await this.tool.fetch(`${baseUrl}/catalog/models/${request.model}`);
    if (!response.ok) return null;
    const catalog = await response.json() as { pricing?: Record<string, unknown>; pricing_tier?: { tier?: unknown; multiplier?: unknown } | null };
    const pricing = catalog.pricing;
    if (!pricing) return null;
    const multiplier = catalog.pricing_tier?.tier === "off_peak" && typeof catalog.pricing_tier.multiplier === "number" ? catalog.pricing_tier.multiplier : 1;
    let amount: number | undefined;
    let estimated = false;
    if (request.type === "image") {
      const size = request.size && tierPixels[request.size] ? request.size : "2K";
      const unit = catalogPrice(pricing, "price_cny", size);
      const input = typeof pricing.price_cny_input_image === "number" ? pricing.price_cny_input_image * (request.images?.length ?? 0) : 0;
      amount = unit === undefined ? undefined : unit + input;
    } else if (request.type === "video") {
      const duration = request.duration ? Math.round(request.duration) : 5;
      const resolution = request.resolution ?? "720p";
      if (pricing.unit === "per_token") {
        // Seedance 按视频 token 计费：宽 × 高 × 帧率(24) × 时长 / 1024，按分辨率档位估算。
        const perMillion = catalogPrice(pricing, "price_cny_per_mtoken", resolution);
        const [width, height] = videoPixels[resolution.toLowerCase()] ?? videoPixels["720p"]!;
        amount = perMillion === undefined ? undefined : width * height * 24 * duration / 1024 / 1e6 * perMillion;
        estimated = true;
      } else {
        const perSecond = catalogPrice(pricing, "price_cny", resolution);
        amount = perSecond === undefined ? undefined : perSecond * duration;
      }
    } else {
      const characters = (request.text ?? request.prompt ?? "").length;
      amount = typeof pricing.price_cny === "number" ? pricing.price_cny * characters : undefined;
    }
    if (amount === undefined) return null;
    const tips = [
      estimated ? "按分辨率与时长估算，实际以 GateMux 结算为准" : "按 GateMux 当前价格计算，实际以结算为准",
      multiplier !== 1 ? "当前为低峰时段价格" : "",
    ].filter(Boolean).join("；");
    return { price: `¥${(amount * multiplier).toFixed(2)}`, tips };
  },

  async getBalance() {
    const value = await (await request(this, `${baseUrl}/v1/account/me`)).json() as { wallet?: { currency?: unknown; balance?: unknown } | null };
    const balance = Number(value.wallet?.balance);
    if (!value.wallet || !Number.isFinite(balance)) throw new Error("当前授权不能读取余额");
    return { balance, unit: value.wallet.currency === "CNY" ? "元" : String(value.wallet.currency) };
  },
} satisfies Provider;

function requestSpeech(context: Context, model: string, input: string, voice: string) {
  return request(context, `${baseUrl}/v1/audio/speech`, { body: { model, input, voice, response_format: "mp3" } });
}
