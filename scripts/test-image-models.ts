/**
 * 测试所有生图模型
 * 使用统一的提示词分别调用三个模型，保存结果到 image-model-test 目录
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";

const BASE_URL = process.env.NEW_API_BASE_URL ?? "https://ops-ai-gateway.yc345.tv";
const API_KEY = process.env.NEW_API_KEY;

// 测试提示词
const TEST_PROMPT = `高质量动漫风格海报，一个初中女生（可爱的动漫学生形象，穿着校服，扎着马尾辫），坐在考场里，面对试卷上的难题，表情先是困惑焦虑，然后突然眼睛亮起来，像是脑子里播放起了动画片，表情变得惊喜和自信，周围漂浮着数学公式和动画课的片段特效，鱼眼镜头，俯拍，大透视，镜头聚焦到人物表情，背景可以微微虚化，逆光效果，人物轮廓有金色光环，增强画面冲击力，标题在人物上方，标题很醒目，设计得很有动漫感，和场景很融合，主标题内容是"考试遇到大难题，脑子里自动播放动画片？"，副标题内容是"考前刷洋葱动画课，死记硬背变追番，考场顺畅写出正确答案"，右下角有"立即下载"按钮，竖版构图，人物居中，4k分辨率，结构清晰，动漫风格，细节丰富。`;

// 要测试的模型列表（每个模型可能有不同的 size 要求）
const MODELS = [
  { name: "gpt-image-1.5", label: "GPT Image 1.5", size: "1024x1024" },
  { name: "gemini-3-pro-image-preview", label: "Gemini 3 Pro", size: "1024x1024" },
  { name: "imagen-3.0-generate-002", label: "Imagen 3.0", size: "1024x1024" }, // Gemini 的 imagen 模型
  { name: "doubao-seedream-5-0-lite", label: "即梦 5.0 Lite", size: "1920x1920" }, // 需要更大尺寸
];

const OUTPUT_DIR = join(process.cwd(), "image-model-test");

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function callImageModel(model: string, size: string): Promise<{ success: boolean; data?: any; error?: string; duration: number }> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${BASE_URL}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model,
        prompt: TEST_PROMPT,
        size,
        n: 1,
      }),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `${response.status} ${text}`, duration };
    }

    const data = await response.json();
    return { success: true, data, duration };
  } catch (err) {
    const duration = Date.now() - startTime;
    return { success: false, error: String(err), duration };
  }
}

async function downloadImage(url: string, outputPath: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (!response.ok) return false;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    writeFileSync(outputPath, buffer);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!API_KEY) {
    console.error("缺少 NEW_API_KEY 环境变量");
    process.exit(1);
  }

  console.log("=== 生图模型测试 ===\n");
  console.log(`提示词长度: ${TEST_PROMPT.length} 字符\n`);
  console.log(`输出目录: ${OUTPUT_DIR}\n`);

  const results: Array<{ model: string; label: string; success: boolean; error?: string; duration: number; imagePath?: string }> = [];

  for (const { name, label, size } of MODELS) {
    console.log(`测试 ${label} (${name})，尺寸 ${size}...`);

    const result = await callImageModel(name, size);

    if (result.success && result.data) {
      console.log(`  ✓ 成功，耗时 ${result.duration}ms`);

      // 保存响应数据
      const jsonPath = join(OUTPUT_DIR, `${name}.json`);
      writeFileSync(jsonPath, JSON.stringify(result.data, null, 2));
      console.log(`  响应数据已保存: ${jsonPath}`);

      // 下载图片
      const imageUrl = result.data.data?.[0]?.url || result.data.data?.[0]?.b64_json;
      if (imageUrl) {
        if (imageUrl.startsWith("http")) {
          const imagePath = join(OUTPUT_DIR, `${name}.png`);
          const downloaded = await downloadImage(imageUrl, imagePath);
          if (downloaded) {
            console.log(`  图片已保存: ${imagePath}`);
            results.push({ model: name, label, success: true, duration: result.duration, imagePath });
          } else {
            console.log(`  图片下载失败`);
            results.push({ model: name, label, success: true, duration: result.duration });
          }
        } else {
          // base64 格式
          const imagePath = join(OUTPUT_DIR, `${name}.png`);
          writeFileSync(imagePath, Buffer.from(imageUrl, "base64"));
          console.log(`  图片已保存 (base64): ${imagePath}`);
          results.push({ model: name, label, success: true, duration: result.duration, imagePath });
        }
      }
    } else {
      console.log(`  ✗ 失败: ${result.error}`);
      console.log(`  耗时 ${result.duration}ms`);
      results.push({ model: name, label, success: false, error: result.error, duration: result.duration });
    }

    console.log("");
  }

  // 保存汇总报告
  const reportPath = join(OUTPUT_DIR, "report.json");
  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`汇总报告已保存: ${reportPath}\n`);

  // 打印汇总
  console.log("=== 测试汇总 ===\n");
  for (const r of results) {
    const status = r.success ? "✓ 成功" : "✗ 失败";
    console.log(`${r.label}: ${status} (${r.duration}ms)`);
    if (r.error) console.log(`  错误: ${r.error}`);
    if (r.imagePath) console.log(`  图片: ${r.imagePath}`);
  }
}

const entryArg = process.argv[1];
const isTestRunner = process.argv.includes("--test") || process.env.NODE_ENV === "test";
const isDirectRun = !isTestRunner && entryArg ? import.meta.url === pathToFileURL(entryArg).href : false;

if (isDirectRun) {
  main().catch(console.error);
}
