import { FEATURE_LIBRARY, TIME_NODES } from "@/lib/constants";

export function recommendRequirementFields(rawInput: string) {
  const text = rawInput.toLowerCase();
  const audience = text.includes("学生") ? "student" : "parent";
  const feature = FEATURE_LIBRARY.find((item) => text.includes(item.name.replace(/精学/g, ""))) ?? FEATURE_LIBRARY[0];
  const timeNode = TIME_NODES.find((item) => rawInput.includes(item)) ?? TIME_NODES[1];

  return {
    businessGoal: "app",
    targetAudience: audience,
    formatType: "image_text",
    feature: feature.name,
    sellingPoints: feature.sellingPoints.slice(0, 2).map((item) => item.label),
    timeNode,
    directionCount: 3,
  };
}
