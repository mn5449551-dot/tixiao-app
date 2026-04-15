import { apiFetch } from "@/lib/api-fetch";

export async function saveDirectionItem(input: {
  directionId: string;
  title: string;
  targetAudience: string;
  adaptationStage: string;
  scenarioProblem: string;
  differentiation: string;
  effect: string;
}) {
  await apiFetch(`/api/directions/${input.directionId}`, {
    method: "PUT",
    body: {
      title: input.title,
      target_audience: input.targetAudience,
      adaptation_stage: input.adaptationStage,
      scenario_problem: input.scenarioProblem,
      differentiation: input.differentiation,
      effect: input.effect,
    },
  });
  return true;
}

export async function deleteDirectionItem(directionId: string) {
  await apiFetch(`/api/directions/${directionId}`, { method: "DELETE" });
  return true;
}

export async function appendDirectionGeneration(input: {
  projectId: string;
  channel: string;
  imageForm: string;
  copyGenerationCount: number;
}) {
  await apiFetch(`/api/projects/${input.projectId}/directions/generate`, {
    method: "POST",
    body: {
      append: true,
      channel: input.channel,
      image_form: input.imageForm,
      copy_generation_count: input.copyGenerationCount,
    },
  });
  return true;
}

export async function generateSelectedDirections(input: {
  directionIds: string[];
  channel: string;
  imageForm: string;
  copyGenerationCount: number;
}) {
  for (const directionId of input.directionIds) {
    await apiFetch(`/api/directions/${directionId}`, {
      method: "PUT",
      body: {
        channel: input.channel,
        image_form: input.imageForm,
        copy_generation_count: input.copyGenerationCount,
      },
    });

    await apiFetch(`/api/directions/${directionId}/copy-cards/generate`, {
      method: "POST",
      body: { count: input.copyGenerationCount },
    });
  }

  return true;
}

export async function deleteDirectionCard(projectId: string) {
  await apiFetch(`/api/projects/${projectId}/directions-card`, { method: "DELETE" });
  return true;
}
