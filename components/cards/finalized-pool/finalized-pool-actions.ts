import type { FinalizedImage } from "@/components/cards/finalized-pool-card";

export async function deleteDerivedGroup(groupId: string) {
  const response = await fetch(`/api/image-groups/${groupId}`, { method: "DELETE" });
  return response.ok;
}

export async function generateFinalizedVariants(input: {
  projectId: string;
  selectedChannels: string[];
  slotNames: string[];
}) {
  const response = await fetch(`/api/projects/${input.projectId}/finalized/variants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      target_channels: input.selectedChannels,
      target_slots: input.slotNames,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    groups?: Array<{ id: string }>;
  };

  return {
    ok: response.ok,
    error: payload.error,
    groups: payload.groups ?? [],
  };
}

export async function exportFinalizedImages(input: {
  projectId: string;
  selectedChannels: string[];
  slotNames: string[];
  fileFormat: "jpg" | "png" | "webp";
  namingRule: string;
}) {
  const response = await fetch(`/api/projects/${input.projectId}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      target_channels: input.selectedChannels,
      target_slots: input.slotNames,
      file_format: input.fileFormat,
      naming_rule: input.namingRule,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: payload.error ?? "导出失败" };
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "export.zip";
  anchor.click();
  window.URL.revokeObjectURL(url);

  return { ok: true, error: null as string | null };
}
