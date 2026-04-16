import { ApiError, apiFetch } from "@/lib/api-fetch";

export async function saveImageConfigAndGenerate(input: {
  copyId: string;
  imageConfigId?: string;
  aspectRatio: string;
  styleMode: string;
  imageStyle: string;
  imageModel: string | null;
  count: number;
  ipRole: string | null;
  referenceImageUrl?: string | null;
  ctaEnabled: boolean;
  ctaText?: string | null;
}) {
  try {
    const body: Record<string, unknown> = {
      aspect_ratio: input.aspectRatio,
      style_mode: input.styleMode,
      ip_role: input.ipRole,
      image_style: input.imageStyle,
      image_model: input.imageModel,
      count: input.count,
      cta_enabled: input.ctaEnabled,
      cta_text: input.ctaText ?? null,
      append: !!input.imageConfigId,
      generate: true,
    };

    if (input.referenceImageUrl !== undefined) {
      body.reference_image_url = input.referenceImageUrl;
    }

    const payload = await apiFetch<{ id?: string; created_group_ids?: string[] }>(
      `/api/copies/${input.copyId}/image-config`,
      { method: "POST", body },
    );

    if (!payload.id) {
      return { ok: false, configSaved: false, error: "图片配置保存失败" };
    }
    return { ok: true, configSaved: true, error: null as string | null };
  } catch (error) {
    return {
      ok: false,
      configSaved: false,
      error: error instanceof ApiError ? error.message : "图片配置保存失败",
    };
  }
}
