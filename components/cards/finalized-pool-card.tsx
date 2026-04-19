"use client";

import dynamic from "next/dynamic";
import type { CSSProperties, ReactElement } from "react";
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
import { Field, Select } from "@/components/ui/field";
import {
  EXPORT_SLOT_SPECS,
  splitExportSlotSpecsByCoverage,
  type ExportSlotSpec,
} from "@/lib/export/utils";
import {
  DEFAULT_FINALIZED_ADAPTATION_MODEL_VALUE,
  FINALIZED_ADAPTATION_MODELS,
} from "@/lib/constants";
import { LOGO_ASSET_OPTIONS } from "@/lib/logo-asset-metadata";
import { cn } from "@/lib/utils";
import { dispatchWorkspaceInvalidated } from "@/lib/workspace-events";

const ImagePreviewModal = dynamic(
  () => import("@/components/ui/image-preview-modal").then((mod) => mod.ImagePreviewModal),
  { ssr: false },
);

export const EXPORT_CHANNELS = ["OPPO", "VIVO", "小米", "荣耀"] as const;

export type FinalizedImage = {
  id: string;
  fileUrl: string | null;
  thumbnailUrl?: string | null;
  aspectRatio: string;
  actualWidth?: number | null;
  actualHeight?: number | null;
  groupLabel?: string;
  isConfirmed?: boolean;
  updatedAt?: number;
};

export type FinalizedGroup = {
  id: string;
  variantIndex: number;
  slotCount: number;
  groupType?: string;
  aspectRatio?: string;
  styleMode?: string;
  imageStyle?: string;
  images: FinalizedImage[];
};

export type FinalizedAsset = {
  ratio: string;
  groupId: string;
  imageIds: string[];
  kind: "source" | "derived";
  images: FinalizedImage[];
};

export type FinalizedPoolCardData = {
  displayMode: "single" | "double" | "triple";
  sourceGroupId: string;
  sourceImageConfigId: string;
  sourceAspectRatio: string;
  sourceImages: FinalizedImage[];
  assets: FinalizedAsset[];
  groups: FinalizedGroup[];
  groupLabel?: string;
  projectId?: string;
  defaultImageModel?: string | null;
};

export type FinalizedPoolCardNode = Node<FinalizedPoolCardData, "finalizedPool">;

function getFinalizedPoolBorderClass(selected: boolean): string {
  return selected
    ? "border-[var(--brand-300)] ring-4 ring-[var(--brand-ring)]"
    : "border-[var(--line-soft)]";
}

function normalizeAssetsFromLegacyGroups(groups: FinalizedGroup[]): FinalizedAsset[] {
  return groups.map((group) => ({
    ratio: group.aspectRatio ?? group.images[0]?.aspectRatio ?? "1:1",
    groupId: group.id,
    imageIds: group.images.map((image) => image.id),
    kind: group.groupType?.startsWith("derived|") ? "derived" : "source",
    images: group.images,
  }));
}

function getAssetLabel(asset: FinalizedAsset): string {
  return asset.kind === "source" ? `${asset.ratio} 原图` : `${asset.ratio} 适配图`;
}

function getActualSizeLabel(image: FinalizedImage | null) {
  if (!image?.actualWidth || !image?.actualHeight) return null;
  return `${image.actualWidth}×${image.actualHeight}`;
}

function getAssetByRatio(assets: FinalizedAsset[], ratio: string) {
  return assets.find((asset) => asset.ratio === ratio) ?? null;
}

function getSourceGroupId(data: FinalizedPoolCardData, assets: FinalizedAsset[]) {
  return data.sourceGroupId ?? assets.find((asset) => asset.kind === "source")?.groupId ?? null;
}

export function FinalizedPoolCard({
  data,
  selected,
}: NodeProps<FinalizedPoolCardNode>): ReactElement {
  const {
    displayMode,
    sourceAspectRatio,
    sourceImages: rawSourceImages,
    assets: rawAssets,
    groups = [],
    groupLabel,
    projectId,
    defaultImageModel,
  } = data;

  const assets = useMemo(
    () => (rawAssets && rawAssets.length > 0 ? rawAssets : normalizeAssetsFromLegacyGroups(groups)),
    [groups, rawAssets],
  );
  const sourceImages = useMemo(
    () => (rawSourceImages && rawSourceImages.length > 0
      ? rawSourceImages
      : assets.find((asset) => asset.kind === "source")?.images ?? []),
    [assets, rawSourceImages],
  );
  const resolvedSourceGroupId = useMemo(() => getSourceGroupId(data, assets), [assets, data]);
  const availableRatios = useMemo(() => Array.from(new Set(assets.map((asset) => asset.ratio))), [assets]);

  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [selectedSlotNames, setSelectedSlotNames] = useState<string[]>([]);
  const [fileFormat, setFileFormat] = useState<"jpg" | "png" | "webp">("jpg");
  const [exportLogo, setExportLogo] = useState<"onion" | "onion_app" | "none">("none");
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [actionLoadingGroupId, setActionLoadingGroupId] = useState<string | null>(null);
  const [regeneratingImageId, setRegeneratingImageId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<FinalizedImage | null>(null);
  const [imageModel, setImageModel] = useState<string>(
    defaultImageModel ?? DEFAULT_FINALIZED_ADAPTATION_MODEL_VALUE,
  );

  const activeSlotSpecs = useMemo(
    () => (activeChannel ? EXPORT_SLOT_SPECS.filter((spec) => spec.channel === activeChannel) : []),
    [activeChannel],
  );
  const { directSlots, adaptationRequiredSlots, specialSlots } = useMemo(
    () => splitExportSlotSpecsByCoverage({ selectedImageRatios: availableRatios, slotSpecs: activeSlotSpecs }),
    [activeSlotSpecs, availableRatios],
  );
  const selectedDirectSlotSpecs = useMemo(
    () => directSlots.filter((slot) => selectedSlotNames.includes(slot.slotName)),
    [directSlots, selectedSlotNames],
  );
  const selectedAdaptiveSlotSpecs = useMemo(
    () => adaptationRequiredSlots.filter((slot) => selectedSlotNames.includes(slot.slotName)),
    [adaptationRequiredSlots, selectedSlotNames],
  );

  const toggleChannel = useCallback((channel: string) => {
    setActiveChannel((prev) => (prev === channel ? null : channel));
    setSelectedSlotNames([]);
  }, []);

  const toggleSlot = useCallback((slotName: string) => {
    setSelectedSlotNames((prev) =>
      prev.includes(slotName) ? prev.filter((item) => item !== slotName) : [...prev, slotName],
    );
  }, []);

  const handleDeleteDerivedAsset = useCallback(async (groupId: string) => {
    setActionLoadingGroupId(groupId);
    try {
      const ok = await deleteDerivedGroup(groupId);
      if (ok) {
        dispatchWorkspaceInvalidated();
      }
    } finally {
      setActionLoadingGroupId(null);
    }
  }, []);

  const handleRegenerateImage = useCallback(async (image: FinalizedImage) => {
    if (!image.id || regeneratingImageId) return;
    setRegeneratingImageId(image.id);
    try {
      const res = await fetch(`/api/images/${image.id}`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setFeedback(payload.error ?? "重新生成失败");
        return;
      }
      dispatchWorkspaceInvalidated();
    } catch {
      setFeedback("重新生成失败");
    } finally {
      setRegeneratingImageId(null);
    }
  }, [regeneratingImageId]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border bg-white p-4 shadow-[var(--shadow-card)] transition",
        getFinalizedPoolBorderClass(selected),
      )}
      style={{ width: 480, maxWidth: "100%" } satisfies CSSProperties}
    >
      <div className="absolute inset-x-0 top-0 h-[4px] bg-[var(--brand-500)]" />
      <Handle
        className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand-500)]"
        position={Position.Left}
        type="target"
      />

      <div className="workflow-drag-handle mb-4 flex cursor-grab items-start justify-between gap-3 border-b border-[#f5f0eb] pb-3 pt-1 active:cursor-grabbing">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{"\u25C9"}</span>
            <h3 className="text-sm font-semibold text-[#4a3728]">定稿卡片</h3>
          </div>
          <p className="text-[11px] text-[var(--ink-400)]">
            {sourceAspectRatio ?? sourceImages[0]?.aspectRatio ?? "1:1"} 原始定稿
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
        <p className="mb-2 text-xs font-medium text-[var(--ink-700)]">原始定稿</p>
        {sourceImages.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {sourceImages.map((image) => (
              <button
                key={image.id}
                type="button"
                className="rounded-xl border border-[var(--line-soft)] bg-white p-2 text-left"
                onClick={() => setPreviewImage(image)}
              >
                <div className="mb-2 aspect-[1/1] overflow-hidden rounded-lg bg-[var(--surface-2)]">
                  {image.fileUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image.thumbnailUrl ?? image.fileUrl} alt="定稿原图" className="h-full w-full object-contain" />
                  ) : null}
                </div>
                <p className="text-xs font-medium text-[var(--ink-700)]">{image.aspectRatio}</p>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--ink-500)]">当前卡片缺少可预览的原始定稿图。</p>
        )}
      </div>

      <div className="mb-3 rounded-[22px] bg-[var(--surface-1)] p-3">
        <p className="mb-2 text-xs font-medium text-[var(--ink-700)]">渠道选择</p>
        <div className="flex flex-wrap gap-2">
          {EXPORT_CHANNELS.map((channel) => {
            const active = activeChannel === channel;
            return (
              <button
                key={channel}
                type="button"
                className={cn(
                  "rounded-full px-3 py-1 text-xs transition",
                  active
                    ? "bg-[var(--brand-50)] text-[var(--brand-700)] ring-1 ring-[var(--brand-400)]"
                    : "bg-white text-[var(--ink-500)] ring-1 ring-[var(--line-soft)]",
                )}
                onClick={() => toggleChannel(channel)}
              >
                {channel}
              </button>
            );
          })}
        </div>
      </div>

      {!activeChannel ? (
        <div className="mb-3 rounded-[22px] bg-[var(--surface-1)] p-3 text-xs text-[var(--ink-500)]">
          请选择渠道后查看该渠道版位
        </div>
      ) : (
        <>
          <div className="mb-3 rounded-[22px] bg-[var(--surface-1)] p-3">
            <p className="mb-2 text-xs font-medium text-[var(--ink-700)]">可直接导出</p>
            {directSlots.length > 0 ? (
              <div className="space-y-2">
                {directSlots.map((slot) => {
                  const active = selectedSlotNames.includes(slot.slotName);
                  const asset = getAssetByRatio(assets, slot.ratio);
                  return (
                    <button
                      key={`${slot.channel}-${slot.slotName}`}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs",
                        active
                          ? "border-[var(--brand-400)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                          : "border-[var(--line-soft)] bg-white text-[var(--ink-600)]",
                      )}
                      onClick={() => toggleSlot(slot.slotName)}
                    >
                      <div>
                        <p className="font-medium">{slot.slotName}</p>
                        <p className="mt-1 text-[11px] text-[var(--ink-500)]">
                          当前使用：{asset ? getAssetLabel(asset) : `${slot.ratio} 资产`}
                        </p>
                      </div>
                      <span>{slot.ratio}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[var(--ink-500)]">当前渠道暂无可直接导出的版位。</p>
            )}
          </div>

          <div className="mb-3 rounded-[22px] bg-[var(--surface-1)] p-3">
            <p className="mb-2 text-xs font-medium text-[var(--ink-700)]">需适配</p>
            {adaptationRequiredSlots.length > 0 ? (
              <div className="space-y-2">
                {adaptationRequiredSlots.map((slot) => {
                  const active = selectedSlotNames.includes(slot.slotName);
                  return (
                    <button
                      key={`${slot.channel}-${slot.slotName}`}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs",
                        active
                          ? "border-[var(--brand-400)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                          : "border-[var(--line-soft)] bg-white text-[var(--ink-600)]",
                      )}
                      onClick={() => toggleSlot(slot.slotName)}
                    >
                      <span className="font-medium">{slot.slotName}</span>
                      <span>{slot.ratio}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[var(--ink-500)]">当前渠道所需比例已齐备。</p>
            )}
          </div>

          <div className="mb-3 rounded-[22px] bg-[var(--surface-1)] p-3">
            <p className="mb-2 text-xs font-medium text-[var(--ink-700)]">暂不支持</p>
            {specialSlots.length > 0 ? (
              <div className="space-y-2 text-xs text-[var(--ink-500)]">
                {specialSlots.map((slot) => (
                  <div
                    key={`${slot.channel}-${slot.slotName}`}
                    className="flex items-center justify-between rounded-xl border border-dashed border-[var(--line-soft)] bg-white px-3 py-2"
                  >
                    <span>{slot.slotName}</span>
                    <span>{slot.ratio}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--ink-500)]">当前渠道没有暂不支持的版位。</p>
            )}
          </div>
        </>
      )}

      <div className="mb-3 rounded-[22px] bg-[var(--surface-1)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-[var(--ink-700)]">已有比例资产</p>
          <p className="text-[11px] text-[var(--ink-500)]">适配图按比例复用，不按渠道重复生成</p>
        </div>
        <div className="space-y-2">
          {assets.map((asset) => {
            const image = asset.images[0] ?? null;
            return (
              <div
                key={asset.groupId}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line-soft)] bg-white px-3 py-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <button
                    type="button"
                    className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[var(--line-soft)] bg-[var(--surface-2)]"
                    onClick={() => image && setPreviewImage(image)}
                    title="查看大图"
                  >
                    {image?.fileUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image.thumbnailUrl ?? image.fileUrl}
                        alt={getAssetLabel(asset)}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-[var(--ink-400)]">无预览</span>
                    )}
                  </button>
                  <div className="min-w-0 text-left">
                    <p className="text-xs font-medium text-[var(--ink-700)]">{getAssetLabel(asset)}</p>
                    <p className="mt-1 text-[11px] text-[var(--ink-500)]">目标比例：{asset.ratio}</p>
                    {getActualSizeLabel(image) ? (
                      <p className="mt-1 text-[11px] text-[var(--ink-500)]">实际尺寸：{getActualSizeLabel(image)}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {image ? (
                    <Button
                      variant="ghost"
                      className="text-xs"
                      onClick={() => image && setPreviewImage(image)}
                    >
                      查看大图
                    </Button>
                  ) : null}
                  {asset.kind === "derived" && image ? (
                    <Button
                      variant="secondary"
                      className="text-xs"
                      disabled={regeneratingImageId === image.id}
                      onClick={() => handleRegenerateImage(image)}
                    >
                      {regeneratingImageId === image.id ? "重生成中..." : "重新生成"}
                    </Button>
                  ) : null}
                  {asset.kind === "derived" ? (
                    <Button
                      variant="ghost"
                      className="text-xs text-[var(--danger-600)]"
                      disabled={actionLoadingGroupId === asset.groupId}
                      onClick={() => handleDeleteDerivedAsset(asset.groupId)}
                    >
                      {actionLoadingGroupId === asset.groupId ? "删除中..." : "删除"}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Select value={imageModel} onChange={(event) => setImageModel(event.target.value)} className="h-8 text-xs">
          {FINALIZED_ADAPTATION_MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          className="shrink-0 text-xs"
          disabled={
            isGeneratingVariants ||
            !projectId ||
            !resolvedSourceGroupId ||
            !activeChannel ||
            selectedAdaptiveSlotSpecs.length === 0
          }
          onClick={async () => {
            if (!projectId || !resolvedSourceGroupId || !activeChannel) return;
            setIsGeneratingVariants(true);
            setFeedback(null);
            try {
              const result = await generateFinalizedVariants({
                projectId,
                sourceGroupId: resolvedSourceGroupId,
                targetChannel: activeChannel,
                slotNames: selectedAdaptiveSlotSpecs.map((slot) => slot.slotName),
                imageModel,
              });
              if (!result.ok) {
                setFeedback(result.error ?? "生成适配版本失败");
                return;
              }
              if (result.skippedSlots.length > 0) {
                setFeedback(`以下版位暂不支持：${result.skippedSlots.join("、")}`);
              } else if (result.groups.length === 0) {
                setFeedback("当前选择的版位无需生成适配版本。");
              } else {
                setFeedback(`已生成 ${result.groups.length} 个适配版本。`);
              }
              dispatchWorkspaceInvalidated();
            } finally {
              setIsGeneratingVariants(false);
            }
          }}
        >
          {isGeneratingVariants ? "生成中..." : "生成适配版本"}
        </Button>
      </div>

      <div className="mb-3 rounded-[22px] bg-[var(--surface-1)] p-3">
        <Field label="文件格式">
          <Select value={fileFormat} onChange={(event) => setFileFormat(event.target.value as "jpg" | "png" | "webp")}>
            <option value="jpg">JPG</option>
            <option value="png">PNG</option>
            <option value="webp">WEBP</option>
          </Select>
        </Field>
      </div>

      <div className="mb-3 rounded-[22px] bg-[var(--surface-1)] p-3">
        <Field label="导出 Logo">
          <Select value={exportLogo} onChange={(event) => setExportLogo(event.target.value as "onion" | "onion_app" | "none")}>
            <option value="none">不添加 Logo</option>
            {LOGO_ASSET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Button
        variant="primary"
        className="w-full py-3.5 text-sm font-semibold"
        disabled={isExporting || !projectId || !resolvedSourceGroupId || !activeChannel || selectedDirectSlotSpecs.length === 0}
        onClick={async () => {
          if (!projectId || !resolvedSourceGroupId || !activeChannel) return;
          setIsExporting(true);
          setFeedback(null);
          try {
            const result = await exportFinalizedImages({
              projectId,
              sourceGroupId: resolvedSourceGroupId,
              targetChannel: activeChannel,
              slotNames: selectedDirectSlotSpecs.map((slot) => slot.slotName),
              logo: exportLogo,
              fileFormat,
              namingRule: "channel_slot_date_version",
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
      >
        {isExporting ? "导出中..." : "导出所选版位"}
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
