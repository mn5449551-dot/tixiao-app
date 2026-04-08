export async function regenerateDirectionItem(directionId: string) {
  const response = await fetch(`/api/directions/${directionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ regenerate: true }),
  });

  return response.ok;
}

export async function saveDirectionItem(input: {
  directionId: string;
  title: string;
  targetAudience: string;
  scenarioProblem: string;
  differentiation: string;
  effect: string;
}) {
  const response = await fetch(`/api/directions/${input.directionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title,
      target_audience: input.targetAudience,
      scenario_problem: input.scenarioProblem,
      differentiation: input.differentiation,
      effect: input.effect,
    }),
  });

  return response.ok;
}

export async function deleteDirectionItem(directionId: string) {
  const response = await fetch(`/api/directions/${directionId}`, { method: "DELETE" });
  return response.ok;
}

export async function appendDirectionGeneration(input: {
  projectId: string;
  channel: string;
  imageForm: string;
  copyGenerationCount: number;
}) {
  const response = await fetch(`/api/projects/${input.projectId}/directions/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      append: true,
      channel: input.channel,
      image_form: input.imageForm,
      copy_generation_count: input.copyGenerationCount,
      use_ai: true,
    }),
  });

  return response.ok;
}

export async function generateSelectedDirections(input: {
  directionIds: string[];
  channel: string;
  imageForm: string;
  copyGenerationCount: number;
}) {
  for (const directionId of input.directionIds) {
    const updateResponse = await fetch(`/api/directions/${directionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: input.channel,
        image_form: input.imageForm,
        copy_generation_count: input.copyGenerationCount,
      }),
    });

    if (!updateResponse.ok) {
      return false;
    }

    const generateResponse = await fetch(`/api/directions/${directionId}/copy-cards/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: input.copyGenerationCount, use_ai: true }),
    });

    if (!generateResponse.ok) {
      return false;
    }
  }

  return true;
}
