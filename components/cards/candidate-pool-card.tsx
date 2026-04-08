"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { useCallback, useMemo, useState } from "react";

import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dispatchWorkspaceInvalidated } from "@/lib/workspace-events";

const ImagePreviewModal = dynamic(
  () => import("@/components/ui/image-preview-modal").then((mod) => mod.ImagePreviewModal),
  { ssr: false },
);

const InpaintModal = dynamic(
  () => import("@/components/inpaint/inpaint-modal").then((mod) => mod.InpaintModal),
  { ssr: false },
);

export type CandidateImage = {
  id: string;
  fileUrl: string | null;
  status: "pending" | "generating" | "done" | "failed";
  slotIndex: number;
  aspectRatio?: string;
};

export type CandidateGroup = {
  id: string;
  variantIndex: number;
  slotCount: number;
  isConfirmed: boolean;
  images: CandidateImage[];
};

export type CardStatus = "idle" | "loading" | "done" | "error" | "partial-success";

export type CandidatePoolCardData = {
  displayMode: "single" | "double" | "triple";
  groups: CandidateGroup[];
  groupLabel?: string;
  status?: CardStatus;
  imageConfigId?: string;
};

export type CandidatePoolCardNode = Node<CandidatePoolCardData, "candidatePool">;

export function CandidatePoolCard({
  data,
  selected,
}: NodeProps<CandidatePoolCardNode>) {
  const { displayMode, groups, groupLabel, status = "idle" } = data;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () =>
      new Set(
        groups.flatMap((group) =>
          group.images.filter((img) => img.status === "done").map((img) => img.id),
        ),
      ),
  );
  const [inpaintImageId, setInpaintImageId] = useState<string | null>(null);
  const [previewImageId, setPreviewImageId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const images = useMemo(() => groups.flatMap((group) => group.images), [groups]);
  const isError = status === "error";
  const isPartialSuccess = status === "partial-success";
  const isDone = status === "done";
  const doneCount = images.filter((img) => img.status === "done").length;
  const borderColorClass = isError
    ? "border-[#c0392b]"
    : isPartialSuccess
      ? "border-[var(--brand-400)]"
      : selected
        ? "border-[var(--brand-300)] ring-4 ring-[var(--brand-ring)]"
        : "border-[var(--line-soft)]";

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === images.length) return new Set();
      return new Set(images.filter((img) => img.status === "done").map((img) => img.id));
    });
  }, [images]);

  const handleDeleteImage = useCallback(async (imageId: string) => {
    try {
      setActionLoading(imageId);
      const response = await fetch(`/api/images/${imageId}`, { method: "DELETE" });
      if (response.ok) {
        dispatchWorkspaceInvalidated();
      }
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    try {
      setActionLoading(groupId);
      const response = await fetch(`/api/image-groups/${groupId}`, { method: "DELETE" });
      if (response.ok) {
        dispatchWorkspaceInvalidated();
      }
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleRegenerateImage = useCallback(async (imageId: string) => {
    try {
      setActionLoading(imageId);
      const response = await fetch(`/api/images/${imageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: true }),
      });
      if (response.ok) {
        dispatchWorkspaceInvalidated();
      }
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleConfirmGroup = useCallback(async (groupId: string, confirmed: boolean, targetNodeId?: string) => {
    try {
      setActionLoading(groupId);
      const response = await fetch(`/api/image-groups/${groupId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed }),
      });
      if (response.ok) {
        void targetNodeId;
        dispatchWorkspaceInvalidated();
      }
    } finally {
      setActionLoading(null);
    }
  }, []);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border bg-white p-4 shadow-[var(--shadow-card)] transition",
        borderColorClass,
      )}
      style={{ width: 440 } satisfies CSSProperties}
    >
      <div className={cn(
        "absolute inset-x-0 top-0 h-[4px]",
        isError ? "bg-[#c0392b]" : isPartialSuccess ? "bg-[var(--brand-400)]" : "bg-[var(--brand-500)]",
      )} />

      <Handle
        className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand-500)]"
        position={Position.Left}
        type="target"
      />
      <Handle
        className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand-500)]"
        position={Position.Right}
        type="source"
      />

      <div className="workflow-drag-handle mb-3 flex cursor-grab items-start justify-between gap-3 border-b border-[#f5f0eb] pb-3 pt-1 active:cursor-grabbing">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{"\u25C9"}</span>
            <h3 className="text-sm font-semibold text-[#4a3728]">候选图池</h3>
            {isDone && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#27ae60] text-white text-[10px]">{"\u2713"}</span>
            )}
          </div>
          <p className="text-[11px] text-[var(--ink-400)]">
            共{displayMode === "single" ? `${images.length}张` : `${groups.length}套`} · 可用{doneCount}张
          </p>
        </div>
        {groupLabel ? <Badge tone="neutral">{groupLabel}</Badge> : null}
      </div>

      {isError && (
        <div className="mb-3 rounded-lg bg-[#fdf2f2] px-3 py-2 text-xs text-[#c0392b]">
          部分图片生成失败，请重试
        </div>
      )}

      <div className="space-y-3 rounded-[22px] bg-[var(--surface-1)] p-3">
        {displayMode === "single"
          ? groups.flatMap((group) =>
              group.images.map((img) => (
                <SingleImageCard
                  key={img.id}
                  image={img}
                  group={group}
                  selected={selectedIds.has(img.id)}
                  loadingKey={actionLoading}
                  onToggleSelect={toggleSelect}
                  onPreview={setPreviewImageId}
                  onInpaint={setInpaintImageId}
                  onRegenerate={handleRegenerateImage}
                  onDelete={handleDeleteImage}
                  onConfirm={() =>
                    handleConfirmGroup(
                      group.id,
                      !group.isConfirmed,
                      data.imageConfigId ? `finalized-${data.imageConfigId}` : undefined,
                    )
                  }
                />
              )),
            )
          : groups.map((group) => (
              <GroupImageCard
                key={group.id}
                group={group}
                displayMode={displayMode}
                loadingKey={actionLoading}
                onPreview={setPreviewImageId}
                onInpaint={setInpaintImageId}
                onRegenerate={handleRegenerateImage}
                onDeleteGroup={handleDeleteGroup}
                onConfirmGroup={() =>
                  handleConfirmGroup(
                    group.id,
                    !group.isConfirmed,
                    data.imageConfigId ? `finalized-${data.imageConfigId}` : undefined,
                  )
                }
              />
            ))}
      </div>

      <div className="my-3 h-px bg-[var(--line-soft)]" />

      {data.imageConfigId && (
        <div className="mb-2 flex justify-end">
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                if (!data.imageConfigId) return;
                const configResponse = await fetch(`/api/image-configs/${data.imageConfigId}`);
                if (!configResponse.ok) throw new Error("无法获取图片配置");
                const configPayload = (await configResponse.json()) as {
                  image_config?: {
                    copyId?: string;
                    aspectRatio?: string;
                    styleMode?: string;
                    ipRole?: string | null;
                    logo?: string;
                    imageStyle?: string;
                    referenceImageUrl?: string | null;
                  };
                };
                const copyId = configPayload?.image_config?.copyId;
                if (!copyId) throw new Error("缺少文案配置上下文");

                const saveResponse = await fetch(`/api/copies/${copyId}/image-config`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    aspect_ratio: configPayload?.image_config?.aspectRatio,
                    style_mode: configPayload?.image_config?.styleMode,
                    ip_role: configPayload?.image_config?.ipRole ?? null,
                    logo: configPayload?.image_config?.logo,
                    image_style: configPayload?.image_config?.imageStyle,
                    reference_image_url: configPayload?.image_config?.referenceImageUrl ?? null,
                    count: 1,
                    append: true,
                  }),
                });
                if (!saveResponse.ok) throw new Error("追加候选组失败");
                const savePayload = (await saveResponse.json()) as { id?: string; groups?: Array<{ id: string }> };
                if (!savePayload.id) throw new Error("追加候选组失败");
                const newGroupIds =
                  (savePayload.groups ?? [])
                    .slice(-1)
                    .map((group) => group.id)
                    .filter(Boolean);

                await fetch(`/api/image-configs/${savePayload.id}/generate`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    group_ids: newGroupIds,
                  }),
                });
                dispatchWorkspaceInvalidated();
              } catch (error) {
                console.error("Failed to append generate:", error);
              }
            }}
            className="text-xs"
          >
            {displayMode === "single" ? "＋ 追加生成一张" : "＋ 追加生成一套"}
          </Button>
        </div>
      )}

      {displayMode === "single" ? (
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={toggleSelectAll} className="shrink-0 text-xs">
            {selectedIds.size === images.length ? "全不选" : "全选"}
          </Button>
          <span className="flex-1 text-center text-xs text-[var(--ink-500)]">
            已选 {selectedIds.size}/{images.length}
          </span>
        </div>
      ) : null}

      {inpaintImageId && (
        <InpaintModal
          imageUrl={images.find((img) => img.id === inpaintImageId)?.fileUrl ?? null}
          onClose={() => setInpaintImageId(null)}
        />
      )}

      {previewImageId ? (
        <ImagePreviewModal
          imageUrl={images.find((img) => img.id === previewImageId)?.fileUrl ?? null}
          title="候选图预览"
          aspectRatio={images.find((img) => img.id === previewImageId)?.aspectRatio}
          onClose={() => setPreviewImageId(null)}
        />
      ) : null}
    </div>
  );
}

function SingleImageCard({
  image,
  group,
  selected,
  loadingKey,
  onToggleSelect,
  onPreview,
  onInpaint,
  onRegenerate,
  onDelete,
  onConfirm,
}: {
  image: CandidateImage;
  group: CandidateGroup;
  selected: boolean;
  loadingKey: string | null;
  onToggleSelect: (id: string) => void;
  onPreview: (id: string) => void;
  onInpaint: (id: string) => void;
  onRegenerate: (id: string) => void;
  onDelete: (id: string) => void;
  onConfirm: () => void;
}) {
  const isGenerating = image.status === "generating" || image.status === "pending";
  const isFailed = image.status === "failed";
  const isDone = image.status === "done";

  return (
    <div className="group overflow-hidden rounded-xl border border-[var(--line-soft)] bg-white">
      <button
        type="button"
        className="relative w-full overflow-hidden bg-[var(--surface-2)]"
        style={{ aspectRatio: toCssAspectRatio(image.aspectRatio) }}
        onClick={() => isDone && onPreview(image.id)}
        disabled={!isDone}
      >
        {isDone && image.fileUrl ? (
          <Image src={image.fileUrl} alt={`候选图 ${image.slotIndex}`} fill sizes="240px" className="object-contain" />
        ) : isGenerating ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            <svg className="h-6 w-6 animate-spin text-[var(--brand-500)]" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-30" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span className="text-[10px] text-[var(--ink-400)]">生成中</span>
          </div>
        ) : isFailed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1">
            <span className="text-lg text-[#c0392b]">{"\u2716"}</span>
            <span className="text-[10px] font-medium text-[#c0392b]">生成失败</span>
          </div>
        ) : null}

        {isDone && (
          <label className="absolute left-1.5 top-1.5 flex items-center gap-1">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(image.id)}
              className="h-3.5 w-3.5 accent-[var(--brand-500)]"
            />
          </label>
        )}
      </button>
      <div className="space-y-2 p-2.5">
        <div className="flex items-center justify-between text-[10px] text-[var(--ink-400)]">
          <span>第 {group.variantIndex} 组</span>
          <span>{group.isConfirmed ? "已定稿" : "候选中"}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="secondary" className="h-7 px-2 text-[10px]" onClick={onConfirm} disabled={!isDone}>
            {group.isConfirmed ? "取消定稿" : "选定稿"}
          </Button>
          <Button variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => onInpaint(image.id)} disabled={!isDone}>
            重绘
          </Button>
          <Button variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => onRegenerate(image.id)} disabled={loadingKey === image.id}>
            重生成
          </Button>
          <Button variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => onDelete(image.id)} disabled={loadingKey === image.id}>
            删除
          </Button>
        </div>
      </div>
    </div>
  );
}

function GroupImageCard({
  group,
  displayMode,
  loadingKey,
  onPreview,
  onInpaint,
  onRegenerate,
  onDeleteGroup,
  onConfirmGroup,
}: {
  group: CandidateGroup;
  displayMode: "double" | "triple";
  loadingKey: string | null;
  onPreview: (id: string) => void;
  onInpaint: (id: string) => void;
  onRegenerate: (id: string) => void;
  onDeleteGroup: (id: string) => void;
  onConfirmGroup: () => void;
}) {
  const groupHasGenerating = group.images.some((image) => image.status === "generating" || image.status === "pending");
  return (
    <div className="overflow-hidden rounded-[24px] border border-[var(--line-soft)] bg-white p-4 shadow-[var(--shadow-inset)]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--ink-900)]">第 {group.variantIndex} 套</p>
          <p className="mt-1 text-[11px] text-[var(--ink-400)]">{displayMode === "double" ? "双图" : "三图"}</p>
        </div>
        <Badge tone={group.isConfirmed ? "success" : groupHasGenerating ? "brand" : "neutral"}>
          {group.isConfirmed ? "已定稿" : groupHasGenerating ? "生成中" : "候选中"}
        </Badge>
      </div>
      <div className={cn("grid gap-3", displayMode === "double" ? "grid-cols-2" : "grid-cols-3")}>
        {group.images.map((image) => {
          const isGenerating = image.status === "generating" || image.status === "pending";
          const isFailed = image.status === "failed";
          const isDone = image.status === "done";

          return (
            <div key={image.id} className="space-y-2">
              <button
                type="button"
                className="relative w-full overflow-hidden rounded-[20px] border border-[var(--line-soft)] bg-[var(--surface-2)]"
                style={{ aspectRatio: toCssAspectRatio(image.aspectRatio) }}
                onClick={() => isDone && onPreview(image.id)}
                disabled={!isDone}
              >
                <div className="absolute left-2 top-2 z-10 rounded-full bg-white/92 px-2 py-1 text-[10px] font-medium text-[var(--ink-700)] shadow-[var(--shadow-card)]">
                  图 {image.slotIndex}
                </div>
                {isDone && image.fileUrl ? (
                  <Image src={image.fileUrl} alt={`候选图 ${image.slotIndex}`} fill sizes="160px" className="object-contain" />
                ) : isGenerating ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                    <svg className="h-5 w-5 animate-spin text-[var(--brand-500)]" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-30" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <span className="text-[10px] text-[var(--ink-400)]">生成中</span>
                  </div>
                ) : isFailed ? (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-[#c0392b]">失败</div>
                ) : null}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" className="h-8 px-2 text-[11px]" onClick={() => onInpaint(image.id)} disabled={!isDone}>
                  重绘
                </Button>
                <Button variant="ghost" className="h-8 px-2 text-[11px]" onClick={() => onRegenerate(image.id)} disabled={loadingKey === image.id}>
                  重生成
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-[var(--line-soft)] pt-3">
        <Button variant="secondary" className="h-9 px-3 text-[11px]" onClick={onConfirmGroup} disabled={groupHasGenerating}>
          {group.isConfirmed ? "取消定稿" : "选定稿"}
        </Button>
        <Button variant="ghost" className="h-9 px-3 text-[11px]" onClick={() => onDeleteGroup(group.id)} disabled={loadingKey === group.id || groupHasGenerating}>
          删除整套
        </Button>
      </div>
    </div>
  );
}

function toCssAspectRatio(value?: string) {
  if (!value) return "1 / 1";
  return value.replace(":", " / ");
}
