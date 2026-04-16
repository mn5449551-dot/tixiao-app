/**
 * 批量图片生成测试脚本
 * 5 条提示词 × 7 个模型 = 最多 35 张图
 * 自动跳过比例不兼容的组合
 *
 * 用法: node scripts/batch-image-gen.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Buffer } from "node:buffer";

const BASE_URL = "https://ops-ai-gateway.yc345.tv";
const API_KEY = "sk-3FnBa3g1mxZoqSFLakLLOOSvERJMYU5Mm8j7hqqvW3V58qdn";
const OUTPUT_DIR = "/Users/xhh/Desktop/test/提示词测试/images";

// ── 模型定义 ──────────────────────────────────────────────
const MODELS = [
  { id: "doubao-seedream-4-0", label: "即梦4.0", transport: "images_generations", ratios: ["1:1", "3:2", "16:9", "9:16"] },
  { id: "doubao-seedream-4-5", label: "即梦4.5", transport: "images_generations", ratios: ["1:1", "3:2", "16:9", "9:16"] },
  { id: "doubao-seedream-5-0-lite", label: "即梦5.0Lite", transport: "images_generations", ratios: ["1:1", "3:2", "16:9", "9:16"] },
  { id: "qwen-image-2.0", label: "通义千问2.0", transport: "images_generations", ratios: ["1:1", "3:2", "16:9", "9:16"] },
  { id: "gemini-3.1-flash-image-preview", label: "Gemini3.1Flash", transport: "chat_completions", ratios: ["1:1", "3:2", "16:9", "9:16"] },
  { id: "gemini-3-pro-image-preview", label: "Gemini3Pro", transport: "chat_completions", ratios: ["16:9", "9:16"] },
  { id: "gpt-image-1.5", label: "GPT-Image1.5", transport: "images_generations", ratios: ["1:1"] },
];

// ── 提示词定义 ────────────────────────────────────────────
const PROMPTS = [
  {
    name: "样例1-单图IP信息流",
    aspectRatio: "9:16",
    prompt: '高质量动漫风格广告海报，一个初中男生（人物特征参考图1，保留脸部特征、脸型和标志性发型的识别度，服装可根据当前学习场景调整为校服或休闲装）正坐在书桌前对着练习册皱眉，一只手拿着手机准备拍题，表情从卡壳的焦虑刚转为即将解决的开窍感，画面主事件是作业卡住后用手机拍题秒出解析的转折瞬间，背景是暖色调的卧室书桌场景，桌上有卷子、笔和台灯，少量发光粒子和轻微速度线从手机屏幕方向散发出来增强动感，人物近景，俯拍，大透视，鱼眼镜头，镜头聚焦人物表情和手机拍题动作，逆光金色光环勾勒人物轮廓，高对比度，氛围光明亮有冲劲，主标题内容是"卡住了？拍一下就懂！"，放在画面上方主视觉区，面积大、醒目、高对比，粗描边动漫字体带轻微发光效果，副标题内容是"AI 拆解题步骤，10 秒继续写"，放在主标题下方，以标签感呈现，层级明确、清晰易读，画面底部加入按钮式行动引导文案，内容是"立即免费试用"，CTA 视觉权重低于主标题但清晰可读，整张图构图干净主体突出，广告海报完成度高，4k，结构清晰，细节丰富',
  },
  {
    name: "样例2-单图Normal应用商店",
    aspectRatio: "1:1",
    prompt: '高质量商业广告海报，一个 12 岁左右的女生坐在明亮的书房里，面前摊开练习册和手机，表情专注且带着"发现规律"的自信微笑，画面主事件是查看错题本自动归类后的清晰知识点脉络，手机屏幕上隐约可见按知识点分类的错题列表，背景是干净整洁的学习空间，柔和的自然光从窗户洒入，画面整体明亮、专业、有信任感，中景，平视，标准镜头，焦点在人物与手机的互动上，少量信息图标和知识点标签元素漂浮在画面周围增强产品功能语义，主标题内容是"错题自动收录 考前秒复盘"，放在画面上方清晰区域，字体醒目、有产品广告感、完整清晰不乱码，副标题内容是"按知识点归类，同类型错题一次搞定"，放在主标题下方，层级明确、清晰易读，整体构图平衡，广告表达清楚，4k，结构清晰，细节丰富',
  },
  {
    name: "样例3-双图IP应用商店",
    aspectRatio: "9:16",
    prompt: '高质量动漫风格系列广告海报，同一个初中女生主角，保留脸部特征、脸型和标志性双马尾发型的识别度，服装穿校服，坐在教室里，面前摊着课本和笔记，表情困惑、眉头紧锁，一只手撑着脑袋，画面主事件是上课没听懂的懵圈状态，背景是明亮但稍显压抑的教室空间，桌面上有数学课本和散落的草稿纸，中景，平视微俯，标准镜头，柔和室内光线，标题内容是"听课一脸懵"，放在画面上方中央，粗描边动漫字体，醒目高对比，与人物避让合理，4k，结构清晰，细节丰富',
  },
  {
    name: "样例4-三图Normal学习机",
    aspectRatio: "16:9",
    prompt: '高质量 3D 立体渲染风格系列广告海报，一个 11 岁左右的小男孩坐在家里的客厅沙发上，面前放着假期作业本，表情无聊、迷茫，一只手托着下巴，画面主事件是寒假在家没有老师指导不知道从哪开始预习的无所适从，背景是温馨的居家客厅，窗外是冬日暖阳但室内稍显慵懒，中景，平视，标准镜头，温暖自然光，标题内容是"放假没人教"，放在画面上方主视觉区，字体醒目统一有设计感，3D 风格字体与画面融合，4k，结构清晰，细节丰富',
  },
  {
    name: "样例5-单图IP信息流3D",
    aspectRatio: "9:16",
    prompt: '高质量动漫风格广告海报，3D 立体渲染质感，一个阳光活力的初中男生，保留脸部特征、脸型和标志性发型的识别度，服装调整为夏日休闲短袖，正在家中开心地使用平板学习，脸上带着轻松自信的笑容，身后是明亮的暑假居家场景，窗外阳光明媚，桌上有笔记本和彩色标签，少量发光星星和速度线粒子围绕人物增强动感，画面主事件是暑假每天 15 分钟动画预习的轻松学习状态，强调"别人玩我在学"的优越感，人物中近景，仰拍，大透视，鱼眼镜头，镜头聚焦人物表情和愉悦的学习动作，逆光金色光环勾勒轮廓，高对比度色彩饱和，霓虹灯和氛围光混合，主标题内容是"暑假偷偷学 开学直接领跑！"，放在画面上方主视觉区，面积大、醒目、高对比，3D 立体字体风格带描边和发光效果，副标题内容是"每天 15 分钟动画课，省心省力"，放在主标题下方，以标签块方式呈现，层级清晰、可读性强，整体构图紧凑不拥挤，商业海报感强烈，4k，结构清晰，细节丰富',
  },
];

// ── 尺寸计算 ──────────────────────────────────────────────
function getSize(modelId, ratio) {
  if (modelId.includes("doubao")) {
    switch (ratio) {
      case "3:2": return "2352x1568";
      case "16:9": return "2560x1440";
      case "9:16": return "1440x2560";
      default: return "1920x1920";
    }
  }
  if (modelId.includes("gemini")) return null; // handled via generationConfig
  switch (ratio) {
    case "3:2": return "1536x1024";
    case "16:9": return "1792x1024";
    case "9:16": return "1024x1792";
    default: return "1024x1024";
  }
}

// ── 图片生成 API 调用 ─────────────────────────────────────
async function generateImage(model, prompt, aspectRatio) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
  };

  let body;
  let endpoint;

  if (model.transport === "chat_completions") {
    endpoint = `${BASE_URL}/v1/chat/completions`;
    body = JSON.stringify({
      model: model.id,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      generationConfig: {
        imageConfig: { imageSize: "2K", aspectRatio },
      },
    });
  } else {
    endpoint = `${BASE_URL}/v1/images/generations`;
    const size = getSize(model.id, aspectRatio);
    body = JSON.stringify({ model: model.id, prompt, size, n: 1 });
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(300_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status}: ${text.slice(0, 500)}`);
  }

  const payload = await response.json();
  return await extractImage(payload);
}

function looksLikeBase64(value) {
  return value.length > 128 && /^[A-Za-z0-9+/=\n\r]+$/.test(value);
}

async function downloadImage(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`下载图片失败: ${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function extractImage(payload) {
  const results = [];
  const visited = new Set();

  async function walk(node) {
    if (!node || typeof node !== "object" || visited.has(node)) return;
    visited.add(node);

    if (Array.isArray(node)) {
      for (const item of node) await walk(item);
      return;
    }

    const record = node;

    // inlineData (Gemini format)
    if (record.inlineData?.data && typeof record.inlineData.data === "string") {
      results.push(Buffer.from(record.inlineData.data, "base64"));
      return;
    }

    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "string") {
        // data URL
        const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (match) {
          results.push(Buffer.from(match[2], "base64"));
          continue;
        }
        // markdown image with data URL
        const mdMatch = value.match(/!\[[^\]]*\]\((data:image\/[a-zA-Z0-9.+-]+;base64,[^)]+)\)/);
        if (mdMatch) {
          const inner = mdMatch[1].match(/^data:image\/[^;]+;base64,(.+)$/);
          if (inner) results.push(Buffer.from(inner[1], "base64"));
          continue;
        }
        // b64_json field
        if ((key === "b64_json" || key === "image_base64" || key === "base64") && looksLikeBase64(value)) {
          try { results.push(Buffer.from(value, "base64")); } catch { /* skip */ }
          continue;
        }
        // url field — download the image
        if ((key === "url" || key === "image_url") && /^https?:\/\//.test(value)) {
          try { results.push(await downloadImage(value)); } catch { /* skip */ }
          continue;
        }
      }
      if (typeof value === "object") await walk(value);
    }
  }

  await walk(payload);
  return results[0] || null;
}

// ── 主流程 ────────────────────────────────────────────────
async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const results = []; // { prompt, model, file, status }
  let total = 0;
  let skipped = 0;

  // Calculate total
  for (const p of PROMPTS) {
    for (const m of MODELS) {
      if (m.ratios.includes(p.aspectRatio)) total++;
      else skipped++;
    }
  }

  console.log(`\n🚀 开始生成: ${total} 张图 (跳过 ${skipped} 个不兼容组合)\n`);

  let i = 0;
  for (const p of PROMPTS) {
    for (const m of MODELS) {
      if (!m.ratios.includes(p.aspectRatio)) {
        results.push({ prompt: p.name, model: m.label, modelId: m.id, status: "skipped", reason: `${p.aspectRatio} 不兼容` });
        continue;
      }

      i++;
      const dir = join(OUTPUT_DIR, p.name);
      mkdirSync(dir, { recursive: true });
      const filename = `${m.label}.png`;
      const filepath = join(dir, filename);

      // Skip if already exists
      if (existsSync(filepath)) {
        console.log(`[${i}/${total}] ⏭  ${p.name} / ${m.label} (已存在)`);
        results.push({ prompt: p.name, model: m.label, modelId: m.id, file: filepath, status: "exists" });
        continue;
      }

      console.log(`[${i}/${total}] 🎨 ${p.name} / ${m.label} ...`);

      try {
        const buffer = await generateImage(m, p.prompt, p.aspectRatio);
        if (buffer) {
          writeFileSync(filepath, buffer);
          console.log(`[${i}/${total}] ✅ ${m.label} → ${filename}`);
          results.push({ prompt: p.name, model: m.label, modelId: m.id, file: filepath, status: "ok" });
        } else {
          console.log(`[${i}/${total}] ❌ ${m.label} → 无法解析图片数据`);
          results.push({ prompt: p.name, model: m.label, modelId: m.id, status: "error", reason: "无法解析图片数据" });
        }
      } catch (err) {
        console.log(`[${i}/${total}] ❌ ${m.label} → ${err.message.slice(0, 200)}`);
        results.push({ prompt: p.name, model: m.label, modelId: m.id, status: "error", reason: err.message.slice(0, 200) });
      }

      // Brief pause between requests to avoid rate limiting
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Generate index HTML
  generateIndexHtml(results);

  // Summary
  const ok = results.filter((r) => r.status === "ok" || r.status === "exists").length;
  const err = results.filter((r) => r.status === "error").length;
  const skip = results.filter((r) => r.status === "skipped").length;
  console.log(`\n📊 完成: ${ok} 成功, ${err} 失败, ${skip} 跳过`);
  console.log(`📁 图片目录: ${OUTPUT_DIR}`);
  console.log(`📄 索引页面: ${join(OUTPUT_DIR, "index.html")}\n`);
}

function generateIndexHtml(results) {
  const promptNames = [...new Set(results.map((r) => r.prompt))];

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>提示词测试 - 模型对比</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; background: #fafafa; }
  h1 { color: #333; margin-bottom: 30px; }
  h2 { color: #555; border-bottom: 2px solid #ff8a00; padding-bottom: 8px; margin-top: 40px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
  .card { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden; }
  .card img { width: 100%; display: block; }
  .card .info { padding: 12px; }
  .card .model-name { font-weight: 600; font-size: 14px; color: #333; }
  .card .status { font-size: 12px; margin-top: 4px; }
  .status-ok { color: #27ae60; }
  .status-error { color: #c0392b; }
  .status-skipped { color: #95a5a6; }
  .summary { background: white; padding: 20px; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .summary table { width: 100%; border-collapse: collapse; }
  .summary th, .summary td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
  .summary th { background: #f8f8f8; font-weight: 600; }
</style>
</head>
<body>
<h1>🎨 提示词 × 模型 对比测试</h1>
<div class="summary">
<table>
  <tr><th>提示词</th><th>模型</th><th>状态</th></tr>
`;

  for (const r of results) {
    const statusClass = r.status === "ok" || r.status === "exists" ? "ok" : r.status;
    const statusText = r.status === "ok" ? "✅ 成功" : r.status === "exists" ? "✅ 已有" : r.status === "skipped" ? `⏭ ${r.reason}` : `❌ ${r.reason?.slice(0, 80) || "失败"}`;
    html += `  <tr><td>${r.prompt}</td><td>${r.model}</td><td class="status-${statusClass}">${statusText}</td></tr>\n`;
  }

  html += `</table></div>\n`;

  for (const pn of promptNames) {
    html += `<h2>${pn}</h2>\n<div class="grid">\n`;
    for (const r of results.filter((r) => r.prompt === pn)) {
      html += `<div class="card">\n`;
      if (r.file) {
        html += `  <img src="images/${pn}/${r.model}.png" alt="${r.model}" loading="lazy">\n`;
      }
      html += `  <div class="info"><div class="model-name">${r.model}</div><div class="status status-${r.status === "ok" || r.status === "exists" ? "ok" : r.status}">${r.status === "ok" || r.status === "exists" ? "生成成功" : r.status === "skipped" ? r.reason : "生成失败"}</div></div>\n</div>\n`;
    }
    html += `</div>\n`;
  }

  html += `</body></html>`;
  writeFileSync(join(OUTPUT_DIR, "index.html"), html);
}

main().catch(console.error);
