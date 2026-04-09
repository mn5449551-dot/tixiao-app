import { NextResponse } from "next/server";

import { saveImageConfig } from "@/lib/project-data";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      aspect_ratio?: string;
      style_mode?: string;
      ip_role?: string | null;
      logo?: string;
      image_style?: string;
      count?: number;
      reference_image_url?: string | null;
      append?: boolean;
      create_groups?: boolean;
    };

    const config = await saveImageConfig(id, {
      aspectRatio: body.aspect_ratio,
      styleMode: body.style_mode,
      ipRole: body.ip_role,
      logo: body.logo,
      imageStyle: body.image_style,
      count: body.count,
      referenceImageUrl: body.reference_image_url,
      append: body.append,
      createGroups: body.create_groups,
    });

    if (!config) {
      return NextResponse.json({ error: "图片配置保存失败" }, { status: 500 });
    }

    return NextResponse.json({
      id: config.id,
      image_config_id: config.id,
      prompt_zh: config.promptZh,
      prompt_en: config.promptEn,
      negative_prompt: config.negativePrompt,
      count: config.count,
      created_group_ids: config.createdGroups?.map((group) => group.id) ?? [],
      groups: config.groups,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "图片配置保存失败" },
      { status: 500 },
    );
  }
}
