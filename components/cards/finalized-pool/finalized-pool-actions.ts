import { ApiError, apiFetch, apiFetchBlob, apiFetchOk } from "@/lib/api-fetch";

export async function deleteDerivedGroup(groupId: string) {
  return apiFetchOk(`/api/image-groups/${groupId}`, { method: "DELETE" });
}

export async function generateFinalizedVariants(input: {
  projectId: string;
  selectedGroupIds: string[];
  selectedChannels: string[];
  slotNames: string[];
  imageModel: string;
}) {
  try {
    const payload = await apiFetch<{ groups?: Array<{ id: string }>; skipped_slots?: string[] }>(
      `/api/projects/${input.projectId}/finalized/variants`,
      {
        method: "POST",
        body: {
          target_group_ids: input.selectedGroupIds,
          target_channels: input.selectedChannels,
          target_slots: input.slotNames,
          image_model: input.imageModel,
        },
      },
    );

    return {
      ok: true,
      error: null as string | null,
      groups: payload.groups ?? [],
      skippedSlots: payload.skipped_slots ?? [],
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ApiError ? error.message : "生成适配版本失败",
      groups: [],
      skippedSlots: [],
    };
  }
}

export async function exportFinalizedImages(input: {
  projectId: string;
  selectedGroupIds: string[];
  selectedChannels: string[];
  slotNames: string[];
  logo: "onion" | "onion_app" | "none";
  fileFormat: "jpg" | "png" | "webp";
  namingRule: string;
}) {
  try {
    const blob = await apiFetchBlob(`/api/projects/${input.projectId}/export`, {
      method: "POST",
      body: {
        target_group_ids: input.selectedGroupIds,
        target_channels: input.selectedChannels,
        target_slots: input.slotNames,
        logo: input.logo,
        file_format: input.fileFormat,
        naming_rule: input.namingRule,
      },
    });

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "export.zip";
    anchor.click();
    window.URL.revokeObjectURL(url);

    return { ok: true, error: null as string | null };
  } catch (error) {
    return { ok: false, error: error instanceof ApiError ? error.message : "导出失败" };
  }
}
