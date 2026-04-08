import { createImageGeneration } from "@/lib/ai/client";

export async function generateImages(prompt: string, count: number) {
  return createImageGeneration({ prompt, n: count });
}
