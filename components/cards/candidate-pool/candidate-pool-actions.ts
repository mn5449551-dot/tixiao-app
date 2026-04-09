import { apiFetch } from "@/lib/api-fetch";

export async function deleteCandidateImage(imageId: string) {
  await apiFetch(`/api/images/${imageId}`, { method: "DELETE" });
  return true;
}

export async function deleteCandidateGroup(groupId: string) {
  await apiFetch(`/api/image-groups/${groupId}`, { method: "DELETE" });
  return true;
}

export async function regenerateCandidateImage(imageId: string) {
  await apiFetch(`/api/images/${imageId}`, {
    method: "POST",
    body: { regenerate: true },
  });
  return true;
}

export async function confirmCandidateGroup(groupId: string, confirmed: boolean) {
  await apiFetch(`/api/image-groups/${groupId}`, {
    method: "PUT",
    body: { confirmed },
  });
  return true;
}
