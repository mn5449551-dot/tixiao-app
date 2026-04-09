import { apiFetch } from "@/lib/api-fetch";

export async function saveCopyItem(input: {
  id: string;
  titleMain: string;
  titleSub: string | null;
  titleExtra: string | null;
}) {
  await apiFetch(`/api/copies/${input.id}`, {
    method: "PUT",
    body: {
      title_main: input.titleMain,
      title_sub: input.titleSub,
      title_extra: input.titleExtra,
    },
  });
  return true;
}

export async function generateCopyConfigAction(input: {
  copyId: string;
  imageForm: string;
}) {
  await apiFetch(`/api/copies/${input.copyId}/image-config`, {
    method: "POST",
    body: {
      aspect_ratio: input.imageForm === "single" ? "1:1" : "3:2",
      style_mode: "normal",
      logo: "onion",
      image_style: "realistic",
      count: 1,
      create_groups: false,
    },
  });
  return true;
}

export async function deleteCopyItemAction(copyId: string) {
  await apiFetch(`/api/copies/${copyId}`, { method: "DELETE" });
  return true;
}

export async function deleteCopyCardAction(copyCardId: string) {
  await apiFetch(`/api/copy-cards/${copyCardId}`, { method: "DELETE" });
  return true;
}

export async function appendCopyGenerationAction(input: {
  directionId: string;
  copyCardId: string;
}) {
  const response = await fetch(`/api/directions/${input.directionId}/copy-cards/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ append: true, use_ai: true, copy_card_id: input.copyCardId }),
  });
  return true;
}
