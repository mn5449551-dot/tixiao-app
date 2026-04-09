import { ApiError, apiFetch } from "@/lib/api-fetch";

export async function saveImageConfigAndGenerate(input: {
  copyId: string;
  imageConfigId?: string;
  aspectRatio: string;
  styleMode: string;
  imageStyle: string;
  count: number;
  logo: string;
  ipRole: string | null;
  referenceImageUrl: string | null;
}) {
  try {
    const payload = await apiFetch<{ id?: string; created_group_ids?: string[] }>(
      `/api/copies/${input.copyId}/image-config`,
      {
      method: "POST",
      body: {
        aspect_ratio: input.aspectRatio,
        style_mode: input.styleMode,
        ip_role: input.ipRole,
        logo: input.logo,
        image_style: input.imageStyle,
        count: input.count,
        reference_image_url: input.referenceImageUrl,
        append: !!input.imageConfigId,
      },
    });

    if (!payload.id) {
      return { ok: false, configSaved: false, error: "图片配置保存失败" };
    }

    try {
      await apiFetch(`/api/image-configs/${payload.id}/generate`, {
        method: "POST",
        body: {
          group_ids:
            payload.created_group_ids && payload.created_group_ids.length > 0
              ? payload.created_group_ids
              : undefined,
        },
      });
      return { ok: true, configSaved: true, error: null as string | null };
    } catch (error) {
      return {
        ok: false,
        configSaved: true,
        error: error instanceof ApiError ? error.message : "图片生成失败",
      };
    }
  } catch (error) {
    return {
      ok: false,
      configSaved: false,
      error: error instanceof ApiError ? error.message : "图片配置保存失败",
    };
  }
}
