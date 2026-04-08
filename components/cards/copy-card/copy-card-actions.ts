export async function saveCopyItem(input: {
  id: string;
  titleMain: string;
  titleSub: string | null;
  titleExtra: string | null;
}) {
  const response = await fetch(`/api/copies/${input.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title_main: input.titleMain,
      title_sub: input.titleSub,
      title_extra: input.titleExtra,
    }),
  });

  return response.ok;
}

export async function generateCopyConfigAction(input: {
  copyId: string;
  imageForm: string;
}) {
  const response = await fetch(`/api/copies/${input.copyId}/image-config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      aspect_ratio: input.imageForm === "single" ? "1:1" : "3:2",
      style_mode: "normal",
      logo: "onion",
      image_style: "realistic",
      count: 1,
    }),
  });

  return response.ok;
}

export async function deleteCopyItemAction(copyId: string) {
  const response = await fetch(`/api/copies/${copyId}`, { method: "DELETE" });
  return response.ok;
}

export async function deleteCopyCardAction(copyCardId: string) {
  const response = await fetch(`/api/copy-cards/${copyCardId}`, { method: "DELETE" });
  return response.ok;
}

export async function appendCopyGenerationAction(directionId: string) {
  const response = await fetch(`/api/directions/${directionId}/copy-cards/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ append: true, use_ai: true }),
  });

  return response.ok;
}
