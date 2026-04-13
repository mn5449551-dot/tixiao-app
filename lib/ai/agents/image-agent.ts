import { createImageGeneration } from "@/lib/ai/client";

export async function generateImages(prompt: string, count: number) {
  return createImageGeneration({
    modelKey: "model_image_generation",
    prompt,
    n: count,
  });
}
