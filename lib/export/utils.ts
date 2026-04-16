export type ExportSlotSpec = {
  channel: string;
  slotName: string;
  ratio: string;
  size: string;
  maxSize: string;
};

export const EXPORT_SLOT_SPECS: ExportSlotSpec[] = [
  { channel: "OPPO", slotName: "富媒体-横版大图", ratio: "16:9", size: "1280×720", maxSize: "<150 KB" },
  { channel: "OPPO", slotName: "富媒体-横版两图", ratio: "9:16", size: "474×768", maxSize: "<150 KB" },
  { channel: "OPPO", slotName: "竞价 banner", ratio: "16:9", size: "1280×720", maxSize: "<150 KB" },
  { channel: "VIVO", slotName: "搜索-首位-三图", ratio: "9:16", size: "1080×1920", maxSize: "<150 KB" },
  { channel: "VIVO", slotName: "搜索富媒体-单图文", ratio: "√2:1", size: "202×142", maxSize: "<50 KB" },
  { channel: "VIVO", slotName: "搜索富媒体-三图", ratio: "3:2", size: "320×211", maxSize: "<80 KB" },
  { channel: "VIVO", slotName: "顶部 banner", ratio: "16:11", size: "720×498", maxSize: "<150 KB" },
  { channel: "小米", slotName: "搜索-大图", ratio: "16:9", size: "960×540", maxSize: "<500 KB" },
  { channel: "小米", slotName: "搜索-二图", ratio: "16:9", size: "960×540", maxSize: "<500 KB" },
  { channel: "小米", slotName: "搜索-横版三图", ratio: "16:9", size: "960×540", maxSize: "<500 KB" },
  { channel: "小米", slotName: "搜索-搜索三图", ratio: "1:1", size: "320×320", maxSize: "<300 KB" },
  { channel: "小米", slotName: "富媒体广告-大图", ratio: "16:9", size: "960×540", maxSize: "<500 KB" },
  { channel: "荣耀", slotName: "大图文", ratio: "16:9", size: "1280×720", maxSize: "<150 KB" },
  { channel: "荣耀", slotName: "三图文", ratio: "9:16", size: "1080×1920", maxSize: "<150 KB" },
];

export type ExportAdaptationMode = "direct" | "transform" | "postprocess";

export function sanitizeExportSegment(input: string) {
  const cleaned = input
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\.\.+/g, "_")
    .replace(/^[._\s-]+|[._\s-]+$/g, "")
    .replace(/_+/g, "_")
    .trim();

  return cleaned || "untitled";
}

export function resolveExportSlotSpecs(input: {
  targetChannels?: string[];
  targetSlots?: string[];
}) {
  const channels = new Set(input.targetChannels ?? []);
  const slots = new Set(input.targetSlots ?? []);

  return EXPORT_SLOT_SPECS.filter((spec) => {
    if (channels.size > 0 && !channels.has(spec.channel)) return false;
    if (slots.size > 0 && !slots.has(spec.slotName)) return false;
    return true;
  });
}

export function parseAspectRatio(value: string) {
  const normalized = value.trim();
  if (normalized === "√2:1") return Math.SQRT2;

  const match = normalized.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || height === 0) {
    return null;
  }

  return width / height;
}

export function parseSlotSize(value: string) {
  const normalized = value.replaceAll("×", "x");
  const match = normalized.match(/^(\d+)\s*x\s*(\d+)$/i);
  if (!match) return null;

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

export function classifyExportAdaptation(sourceRatio: string, targetRatio: string): ExportAdaptationMode {
  if (sourceRatio === targetRatio) return "direct";

  if (targetRatio === "16:11" || targetRatio === "√2:1") {
    return "postprocess";
  }

  return "transform";
}

export function buildExportFileName(input: {
  projectTitle: string;
  channel: string;
  slotName: string;
  ratio: string;
  index: number;
  format: string;
  namingRule?: string;
}) {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const projectTitle = sanitizeExportSegment(input.projectTitle);
  const channel = sanitizeExportSegment(input.channel);
  const slotName = sanitizeExportSegment(input.slotName);
  const ratio = sanitizeExportSegment(input.ratio.replace(":", "x"));
  const seq = String(input.index).padStart(2, "0");

  if (
    input.namingRule === "channel_slot_date_version" ||
    input.namingRule === "渠道_版位_日期_版本"
  ) {
    return `${projectTitle}_${channel}_${slotName}_${ratio}_${date}_${seq}.${input.format}`;
  }

  return `${projectTitle}_${seq}.${input.format}`;
}

export function isSpecialRatio(ratio: string): boolean {
  return ratio === "16:11" || ratio === "√2:1";
}

export function findUncoveredExportSlots(input: {
  selectedImageRatios: string[];
  slotSpecs: ExportSlotSpec[];
}) {
  return input.slotSpecs.filter((slot) =>
    !input.selectedImageRatios.some((ratio) => classifyExportAdaptation(ratio, slot.ratio) === "direct"),
  );
}

export function splitExportSlotSpecsByCoverage(input: {
  selectedImageRatios: string[];
  slotSpecs: ExportSlotSpec[];
}) {
  const specialSlots: ExportSlotSpec[] = [];
  const directSlots: ExportSlotSpec[] = [];
  const adaptationRequiredSlots: ExportSlotSpec[] = [];

  for (const slot of input.slotSpecs) {
    if (isSpecialRatio(slot.ratio)) {
      specialSlots.push(slot);
      continue;
    }

    if (input.selectedImageRatios.some((ratio) => classifyExportAdaptation(ratio, slot.ratio) === "direct")) {
      directSlots.push(slot);
      continue;
    }

    adaptationRequiredSlots.push(slot);
  }

  return {
    directSlots,
    adaptationRequiredSlots,
    specialSlots,
  };
}

export function mergeSelectedGroupIds(
  currentSelectedGroupIds: Iterable<string>,
  generatedGroupIds: Iterable<string>,
) {
  const next = new Set(currentSelectedGroupIds);
  for (const groupId of generatedGroupIds) {
    next.add(groupId);
  }
  return [...next];
}
