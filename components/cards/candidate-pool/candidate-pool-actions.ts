type ImageConfigPayload = {
  image_config?: {
    copyId?: string;
    aspectRatio?: string;
    styleMode?: string;
    ipRole?: string | null;
    logo?: string;
    imageStyle?: string;
    referenceImageUrl?: string | null;
  };
};

export async function deleteCandidateImage(imageId: string) {
  const response = await fetch(`/api/images/${imageId}`, { method: "DELETE" });
  return response.ok;
}

export async function deleteCandidateGroup(groupId: string) {
  const response = await fetch(`/api/image-groups/${groupId}`, { method: "DELETE" });
  return response.ok;
}

export async function regenerateCandidateImage(imageId: string) {
  const response = await fetch(`/api/images/${imageId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ regenerate: true }),
  });
  return response.ok;
}

export async function confirmCandidateGroup(groupId: string, confirmed: boolean) {
  const response = await fetch(`/api/image-groups/${groupId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmed }),
  });
  return response.ok;
}

export async function appendCandidateGeneration(input: {
  imageConfigId: string;
}) {
  const configResponse = await fetch(`/api/image-configs/${input.imageConfigId}`);
  if (!configResponse.ok) {
    throw new Error("无法获取图片配置");
  }

  const configPayload = (await configResponse.json()) as ImageConfigPayload;
  const copyId = configPayload.image_config?.copyId;
  if (!copyId) {
    throw new Error("缺少文案配置上下文");
  }

  const saveResponse = await fetch(`/api/copies/${copyId}/image-config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      aspect_ratio: configPayload.image_config?.aspectRatio,
      style_mode: configPayload.image_config?.styleMode,
      ip_role: configPayload.image_config?.ipRole ?? null,
      logo: configPayload.image_config?.logo,
      image_style: configPayload.image_config?.imageStyle,
      reference_image_url: configPayload.image_config?.referenceImageUrl ?? null,
      count: 1,
      append: true,
    }),
  });
  if (!saveResponse.ok) {
    throw new Error("追加候选组失败");
  }

  const savePayload = (await saveResponse.json()) as { id?: string; groups?: Array<{ id: string }> };
  if (!savePayload.id) {
    throw new Error("追加候选组失败");
  }

  const newGroupIds = (savePayload.groups ?? [])
    .slice(-1)
    .map((group) => group.id)
    .filter(Boolean);

  const generateResponse = await fetch(`/api/image-configs/${savePayload.id}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ group_ids: newGroupIds }),
  });

  return generateResponse.ok;
}
