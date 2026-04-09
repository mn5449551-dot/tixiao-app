"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { useCallback, useMemo, useState } from "react";

import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  deleteDerivedGroup,
  exportFinalizedImages,
  generateFinalizedVariants,
} from "@/components/cards/finalized-pool/finalized-pool-actions";
import { FinalizedPreviewCard } from "@/components/cards/finalized-pool/finalized-preview-card";
import { Field, Input, Select } from "@/components/ui/field";
import {
  classifyExportAdaptation,
  EXPORT_SLOT_SPECS,
  type ExportSlotSpec,
} from "@/lib/export/utils";
import { cn, toCssAspectRatio } from "@/lib/utils";
import { dispatchWorkspaceInvalidated } from "@/lib/workspace-events";

const ImagePreviewModal = dynamic(
  () => import("@/components/ui/image-preview-modal").then((mod) => mod.ImagePreviewModal),
  { ssr: false },
);

export const EXPORT_CHANNELS = ["OPPO", "VIVO", "小米", "荣耀"] as const;

export type FinalizedImage = {
  id: string;
  fileUrl: string | null;
  aspectRatio: string;
  groupLabel?: string;
  isConfirmed: boolean;
  updatedAt?: number;
};

export type FinalizedGroup = {
  id: string;
  variantIndex: number;
  slotCount: number;
  groupType?: string;
  images: FinalizedImage[];
};

export type FinalizedPoolCardData = {
  displayMode: "single" | "double" | "triple";
  groups: FinalizedGroup[];
  groupLabel?: string;
  projectId?: string;
};

export type FinalizedPoolCardNode = Node<FinalizedPoolCardData, "finalizedPool">;

function isDerivedGroup(group: { groupType?: string }) {
  return group.groupType?.startsWith("derived|") ?? false;
}

function getSlotsForChannels(channels: string[]): ExportSlotSpec[] {
  if (channels.length === 0) return [];
  return EXPORT_SLOT_SPECS.filter((spec) => channels.includes(spec.channel));
}

export function FinalizedPoolCard({
  data,
  selected,
}: NodeProps<FinalizedPoolCardNode>) {
  const { displayMode, groups, groupLabel, projectId } = data;
  const [selectedChannels, setSelectedChannels] = useState<string[]>([EXPORT_CHANNELS[0]]);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [fileFormat, setFileFormat] = useState<"jpg" | "png" | "webp">("jpg");
  const [namingRule, setNamingRule] = useState("channel_slot_date_version");
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [actionLoadingGroupId, setActionLoadingGroupId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<FinalizedImage | null>(null);

  const confirmedImages = useMemo(() => groups.flatMap((group) => group.images), [groups]);
  const availableSlots = useMemo(() => getSlotsForChannels(selectedChannels), [selectedChannels]);
  const selectedSlotSpecs = useMemo(
    () => (selectedSlots.length > 0 ? availableSlots.filter((slot) => selectedSlots.includes(slot.slotName)) : availableSlots),
    [availableSlots, selectedSlots],
  );
  const adaptationSummary = useMemo(() => {
    let direct = 0;
    let transform = 0;
    let postprocess = 0;

    for (const slot of selectedSlotSpecs) {
      for (const image of confirmedImages) {
        const mode = classifyExportAdaptation(image.aspectRatio, slot.ratio);
        if (mode === "direct") direct += 1;
        else if (mode === "transform") transform += 1;
        else postprocess += 1;
      }
    }

    return { direct, transform, postprocess };
  }, [confirmedImages, selectedSlotSpecs]);

  const toggleChannel = useCallback((channel: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channel) ? prev.filter((item) => item !== channel) : [...prev, channel],
    );
    setSelectedSlots([]);
  }, []);

  const toggleSlot = useCallback((slotName: string) => {
    setSelectedSlots((prev) =>
      prev.includes(slotName) ? prev.filter((item) => item !== slotName) : [...prev, slotName],
    );
  }, []);

  const exportCount = displayMode === "single" ? confirmedImages.length : groups.length;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border bg-white p-4 shadow-[var(--shadow-card)] transition",
        selected
          ? "border-[var(--brand-300)] ring-4 ring-[var(--brand-ring)]"
          : "border-[var(--line-soft)]",
      )}
      style={{ width: 480 } satisfies CSSProperties}
    >
      <div className="absolute inset-x-0 top-0 h-[4px] bg-[var(--brand-500)]" />
      <Handle
        className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand-500)]"
        position={Position.Left}
        type="target"
      />

      <div className="workflow-drag-handle mb-3 flex cursor-grab items-start justify-between gap-3 border-b border-[#f5f0eb] pb-3 pt-1 active:cursor-grabbing">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{"\u25C9"}</span>
            <h3 className="text-sm font-semibold text-[#4a3728]">定稿池</h3>
          </div>
          <p className="text-[11px] text-[var(--ink-400)]">
            {displayMode === "single" ? `共 ${confirmedImages.length} 张已定稿` : `共 ${groups.length} 套已定稿`}
          </p>
        </div>
        {groupLabel ? <Badge tone="success">{groupLabel}</Badge> : null}
      </div>

      {feedback ? (
        <div className="mb-3 rounded-lg bg-[#fff7ed] px-3 py-2 text-xs text-[#9b6513]">
          {feedback}
        </div>
      ) : null}

      <div className="mb-3 rounded-[22px] bg-[var(--surface-1)] p-3">
        <p className="mb-2 text-xs font-medium text-[var(--ink-700)]">已定稿预览</p>
        {displayMode === "single" ? (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.id} className="rounded-xl border border-[var(--line-soft)] bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-[var(--ink-800)]">
                    {isDerivedGroup(group) ? "适配版本" : `第 ${group.variantIndex} 组`}
                  </p>
                  {isDerivedGroup(group) ? <Badge tone="brand">适配版本</Badge> : <Badge tone="success">原始定稿</Badge>}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {group.images.map((image) => (
                    <FinalizedPreviewCard key={image.id} image={image} onPreview={setPreviewImage} />
                  ))}
                </div>
                {isDerivedGroup(group) ? (
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="ghost"
                      className="text-xs"
                      disabled={actionLoadingGroupId === group.id}
                      onClick={async () => {
                        setActionLoadingGroupId(group.id);
                        try {
                          const ok = await deleteDerivedGroup(group.id);
                          if (ok) {
                            dispatchWorkspaceInvalidated();
                          }
                        } finally {
                          setActionLoadingGroupId(null);
                        }
                      }}
                    >
                      删除适配版本
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.id} className="rounded-xl border border-[var(--line-soft)] bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-[var(--ink-800)]">第 {group.variantIndex} 套</p>
                  <div className="flex items-center gap-2">
                    {isDerivedGroup(group) ? <Badge tone="brand">适配版本</Badge> : null}
                    <Badge tone="success">{group.slotCount} 图</Badge>
                  </div>
                </div>
                <div className={cn("grid gap-2", displayMode === "double" ? "grid-cols-2" : "grid-cols-3")}>
                  {group.images.map((image) => (
                    <FinalizedPreviewCard key={image.id} image={image} compact onPreview={setPreviewImage} />
                  ))}
                </div>
                {isDerivedGroup(group) ? (
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="ghost"
                      className="text-xs"
                      disabled={actionLoadingGroupId === group.id}
                      onClick={async () => {
                        setActionLoadingGroupId(group.id);
                        try {
                          const ok = await deleteDerivedGroup(group.id);
                          if (ok) {
                            dispatchWorkspaceInvalidated();
                          }
                        } finally {
                          setActionLoadingGroupId(null);
                        }
                      }}
                    >
                      删除适配版本
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-3 rounded-[22px] bg-[var(--surface-1)] p-3">
        <p className="mb-2 text-xs font-medium text-[var(--ink-700)]">投放渠道</p>
        <div className="flex flex-wrap gap-2">
          {EXPORT_CHANNELS.map((channel) => {
            const active = selectedChannels.includes(channel);
            return (
              <button
                key={channel}
                type="button"
                className={cn(
                  "rounded-full px-3 py-1 text-xs transition",
                  active
                    ? "bg-[var(--brand-50)] text-[var(--brand-700)] ring-1 ring-[var(--brand-300)]"
                    : "bg-white text-[var(--ink-600)] ring-1 ring-[var(--line-soft)]",
                )}
                onClick={() => toggleChannel(channel)}
              >
                {channel}
              </button>
            );
          })}
        </div>
      </div>

      {availableSlots.length > 0 && (
        <div className="mb-3 rounded-[22px] bg-[var(--surface-1)] p-3">
          <p className="mb-2 text-xs font-medium text-[var(--ink-700)]">投放版位</p>
          <div className="space-y-1.5">
            {availableSlots.map((slot) => {
              const active = selectedSlots.length === 0 || selectedSlots.includes(slot.slotName);
              const slotModes = confirmedImages.map((image) => classifyExportAdaptation(image.aspectRatio, slot.ratio));
              const hasPostprocess = slotModes.includes("postprocess");
              const hasTransform = slotModes.includes("transform");
              const statusLabel = hasPostprocess ? "需后处理" : hasTransform ? "需适配" : "可直接导出";
              return (
                <button
                  key={`${slot.channel}-${slot.slotName}`}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition",
                    active
                      ? "bg-[var(--brand-50)] text-[var(--brand-700)]"
                      : "bg-white text-[var(--ink-600)]",
                  )}
                  onClick={() => toggleSlot(slot.slotName)}
                >
                  <span className="font-medium">{slot.channel} · {slot.slotName}</span>
                  <span className="text-[10px] text-[var(--ink-400)]">{slot.ratio} · {slot.size} · {statusLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-3 rounded-[22px] bg-[var(--surface-1)] p-3">
        <p className="mb-2 text-xs font-medium text-[var(--ink-700)]">导出预览</p>
        <p className="text-xs text-[var(--ink-500)]">
          将导出 {exportCount} {displayMode === "single" ? "张" : "套"} × {selectedSlotSpecs.length} 个版位
        </p>
        <p className="mt-2 text-xs text-[var(--ink-500)]">
          直接导出 {adaptationSummary.direct}，需适配 {adaptationSummary.transform}，需后处理 {adaptationSummary.postprocess}
        </p>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3 rounded-[22px] bg-[var(--surface-1)] p-3">
        <Field label="文件格式">
          <Select value={fileFormat} onChange={(event) => setFileFormat(event.target.value as "jpg" | "png" | "webp")}>
            <option value="jpg">JPG</option>
            <option value="png">PNG</option>
            <option value="webp">WEBP</option>
          </Select>
        </Field>
        <Field label="命名规则">
          <Input
            value={namingRule}
            onChange={(event) => setNamingRule(event.target.value)}
            placeholder="channel_slot_date_version"
          />
        </Field>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Button
          variant="secondary"
          className="shrink-0 text-xs"
          disabled={isGeneratingVariants || selectedSlotSpecs.length === 0 || !projectId}
          onClick={async () => {
            if (!projectId) return;
            setIsGeneratingVariants(true);
            setFeedback(null);
            try {
              const result = await generateFinalizedVariants({
                projectId,
                selectedChannels,
                slotNames: selectedSlotSpecs.map((slot) => slot.slotName),
              });
              if (!result.ok) {
                setFeedback(result.error ?? "生成适配版本失败");
                return;
              }
              if (result.groups.length === 0) {
                setFeedback("当前选中版位都可直接导出，无需生成适配版本。");
                return;
              }
              setFeedback(`已生成 ${result.groups.length} 个适配版本。`);
              dispatchWorkspaceInvalidated();
            } finally {
              setIsGeneratingVariants(false);
            }
          }}
        >
          {isGeneratingVariants ? "生成中..." : "生成适配版本"}
        </Button>
      </div>

      <Button
        variant="primary"
        className="w-full text-xs"
        onClick={async () => {
          if (groups.length === 0 || selectedChannels.length === 0 || !projectId) return;
          setIsExporting(true);
          setFeedback(null);
          try {
            const result = await exportFinalizedImages({
              projectId,
              selectedChannels,
              slotNames: selectedSlotSpecs.map((slot) => slot.slotName),
              fileFormat,
              namingRule,
            });
            if (!result.ok) {
              setFeedback(result.error ?? "导出失败");
              return;
            }
            setFeedback("导出已开始下载。");
          } finally {
            setIsExporting(false);
          }
        }}
        disabled={isExporting}
      >
        {isExporting ? "导出中..." : "确认导出"}
      </Button>

      {previewImage ? (
        <ImagePreviewModal
          imageUrl={previewImage.fileUrl}
          title="定稿图预览"
          aspectRatio={previewImage.aspectRatio}
          onClose={() => setPreviewImage(null)}
        />
      ) : null}
    </div>
  );
}
