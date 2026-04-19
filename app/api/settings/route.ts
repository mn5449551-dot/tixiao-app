import { NextResponse } from "next/server";

import { getAllModelSettings, upsertSetting, type ModelSettingKey } from "@/lib/project-data";

const VALID_MODEL_KEYS: ModelSettingKey[] = [
  "model_direction",
  "model_copy",
  "model_assistant",
  "model_image_description",
];

export async function GET() {
  const settings = getAllModelSettings();
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { key?: string; value?: string };

  if (!body.key || !body.value) {
    return NextResponse.json({ error: "缺少 key 或 value" }, { status: 400 });
  }

  if (!VALID_MODEL_KEYS.includes(body.key as ModelSettingKey)) {
    return NextResponse.json({ error: "无效的配置键" }, { status: 400 });
  }

  const ok = upsertSetting(body.key, body.value);
  if (!ok) {
    return NextResponse.json({ error: "保存失败" }, { status: 500 });
  }

  const settings = getAllModelSettings();
  return NextResponse.json({ settings });
}