export async function saveImageConfigAndGenerate(input: {
  copyId: string;
  aspectRatio: string;
  styleMode: string;
  imageStyle: string;
  count: number;
  logo: string;
  ipRole: string | null;
  referenceImageUrl: string | null;
}) {
  const configResponse = await fetch(`/api/copies/${input.copyId}/image-config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      aspect_ratio: input.aspectRatio,
      style_mode: input.styleMode,
      ip_role: input.ipRole,
      logo: input.logo,
      image_style: input.imageStyle,
      count: input.count,
      reference_image_url: input.referenceImageUrl,
    }),
  });
  if (!configResponse.ok) {
    const payload = (await configResponse.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: payload.error ?? "图片配置保存失败" };
  }

  const payload = (await configResponse.json()) as { id?: string };
  if (!payload.id) {
    return { ok: false, error: "图片配置保存失败" };
  }

  const generateResponse = await fetch(`/api/image-configs/${payload.id}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!generateResponse.ok) {
    const errorPayload = (await generateResponse.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: errorPayload.error ?? "图片生成失败" };
  }

  return { ok: true, error: null as string | null };
}
