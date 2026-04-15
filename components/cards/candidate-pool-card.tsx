"use client";

import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { useCallback, useMemo, useState } from "react";

import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  confirmCandidateGroup,
  deleteCandidateGroup,
  deleteCandidateImage,
  regenerateCandidateImage,
} from "@/components/cards/candidate-pool/candidate-pool-actions";
import { CandidateGroupCard } from "@/components/cards/candidate-pool/candidate-group-card";
import { CandidateImageCard } from "@/components/cards/candidate-pool/candidate-image-card";
import { PromptDetailsModal, type PromptDetails } from "@/components/cards/candidate-pool/prompt-details-modal";
import { ApiError } from "@/lib/api-fetch";
import type { CardStatus } from "@/lib/constants";
import { IMAGE_MODELS } from "@/lib/constants";
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
  updatedAt?: number;
  inpaintParentId?: string | null;
  promptDetails?: {
    promptText: string | null;
    negativePrompt: string | null;
    model: string | null;
    aspectRatio: string | null;
    referenceImages: Array<{ url: string }>;
    hasSnapshot: boolean;
  } | null;
};

export type CandidateGroup = {
  id: string;
  variantIndex: number;
  slotCount: number;
  isConfirmed: boolean;
  aspectRatio: string;
  styleMode: string;
  imageStyle: string;
  images: CandidateImage[];
};

export type CandidatePoolCardData = {
  displayMode: "single" | "double" | "triple";
  groups: CandidateGroup[];
  groupLabel?: string;
  status?: CardStatus;
  imageConfigId?: string;
  imageModel?: string | null;
};

export type CandidatePoolCardNode = Node<CandidatePoolCardData, "candidatePool">;

export function CandidatePoolCard({
  data,
  selected,
}: NodeProps<CandidatePoolCardNode>) {
  const { displayMode, groups, groupLabel, status = "idle", imageModel } = data;
  const modelLabel = imageModel ? (IMAGE_MODELS.find((m) => m.value === imageModel)?.label ?? imageModel) : null;
  const latestVariantIndex = Math.max(...groups.map((group) => group.variantIndex), 0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [inpaintImageId, setInpaintImageId] = useState<string | null>(null);
  const [previewImageId, setPreviewImageId] = useState<string | null>(null);
  const [promptDetailsImageId, setPromptDetailsImageId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const images = useMemo(() => groups.flatMap((group) => group.images), [groups]);
  const promptDetailsImage = useMemo(
    () => (promptDetailsImageId ? images.find((img) => img.id === promptDetailsImageId) ?? null : null),
    [images, promptDetailsImageId],
  );
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
    const selectableIds = images.filter((img) => img.status === "done").map((img) => img.id);
    setSelectedIds((prev) => {
      if (prev.size === selectableIds.length) return new Set();
      return new Set(selectableIds);
    });
  }, [images]);

  const handleDeleteImage = useCallback(async (imageId: string) => {
    try {
      setActionError(null);
      setActionLoading(imageId);
      await deleteCandidateImage(imageId);
      dispatchWorkspaceInvalidated();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "删除图片失败");
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    try {
      setActionError(null);
      setActionLoading(groupId);
      await deleteCandidateGroup(groupId);
      dispatchWorkspaceInvalidated();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "删除候选组失败");
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleRegenerateImage = useCallback(async (imageId: string) => {
    try {
      setActionError(null);
      setActionLoading(imageId);
      await regenerateCandidateImage(imageId);
      dispatchWorkspaceInvalidated();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "重生成失败");
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleDiscardInpaint = useCallback(async (imageId: string) => {
    try {
      setActionError(null);
      setActionLoading(imageId);
      await deleteCandidateImage(imageId);
      dispatchWorkspaceInvalidated();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "放弃重绘失败");
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleConfirmGroup = useCallback(async (groupId: string, confirmed: boolean) => {
    try {
      setActionError(null);
      setActionLoading(groupId);
      await confirmCandidateGroup(groupId, confirmed);
      dispatchWorkspaceInvalidated();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "更新定稿状态失败");
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleCopyPromptText = useCallback(async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyFeedback(`${label}已复制`);
      window.setTimeout(() => setCopyFeedback(null), 1600);
    } catch {
      setCopyFeedback(`${label}复制失败`);
    }
  }, []);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border bg-white p-4 shadow-[var(--shadow-card)] transition",
        borderColorClass,
      )}
      style={{ width: 440, maxWidth: '100%' } satisfies CSSProperties}
    >
      <div className={cn(
        "absolute inset-x-0 top-0 h-1.5",
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

      {actionError ? (
        <div className="mb-3 rounded-lg bg-[#fdf2f2] px-3 py-2 text-xs text-[#c0392b]">
          {actionError}
        </div>
      ) : null}

      {copyFeedback ? (
        <div className="mb-3 rounded-lg bg-[var(--surface-1)] px-3 py-2 text-xs text-[var(--ink-600)]">
          {copyFeedback}
        </div>
      ) : null}

      <div className="space-y-3 rounded-[22px] bg-[var(--surface-1)] p-3">
        {displayMode === "single"
          ? groups.flatMap((group) =>
              group.images.map((img) => (
                <CandidateImageCard
                  key={img.id}
                  image={img}
                  selected={selectedIds.has(img.id)}
                  loadingKey={actionLoading}
                  onToggleSelect={toggleSelect}
                  onPreview={setPreviewImageId}
                  onInpaint={setInpaintImageId}
                  onRegenerate={handleRegenerateImage}
                  onViewPromptDetails={setPromptDetailsImageId}
                  onDelete={handleDeleteImage}
                  onDiscardInpaint={handleDiscardInpaint}
                  footer={
                    <>
                      <div className="flex items-center justify-between text-[10px] text-[var(--ink-400)]">
                        <span>第 {group.variantIndex} 组{modelLabel ? ` · ${modelLabel}` : ""}</span>
                        <span>{group.isConfirmed ? "已定稿" : "候选中"}</span>
                      </div>
                      <Button
                        variant="secondary"
                        className="h-7 px-2 text-[10px]"
                        onClick={() =>
                          handleConfirmGroup(
                            group.id,
                            !group.isConfirmed,
                          )
                        }
                        disabled={img.status !== "done"}
                      >
                        {group.isConfirmed ? "取消定稿" : "选定稿"}
                      </Button>
                    </>
                  }
                />
              )),
            )
          : groups.map((group) => (
              <CandidateGroupCard
                key={group.id}
                group={group}
                displayMode={displayMode}
                isLatest={group.variantIndex === latestVariantIndex}
                modelLabel={modelLabel}
                loadingKey={actionLoading}
                onPreview={setPreviewImageId}
                onInpaint={setInpaintImageId}
                onRegenerate={handleRegenerateImage}
                onViewPromptDetails={setPromptDetailsImageId}
                onDeleteGroup={handleDeleteGroup}
                onDiscardInpaint={handleDiscardInpaint}
                onConfirmGroup={() =>
                  handleConfirmGroup(
                    group.id,
                    !group.isConfirmed,
                  )
                }
              />
            ))}
      </div>

      {displayMode === "single" ? (
        <div className="mt-3 flex items-center gap-2.5">
          <Button variant="secondary" onClick={toggleSelectAll} className="shrink-0 text-xs">
            {selectedIds.size === doneCount ? "全不选" : "全选"}
          </Button>
          <span className="flex-1 text-center text-xs text-[var(--ink-500)]">
            已选 {selectedIds.size}/{doneCount}
          </span>
        </div>
      ) : null}

      {inpaintImageId && (
        <InpaintModal
          imageId={inpaintImageId}
          imageUrl={images.find((img) => img.id === inpaintImageId)?.fileUrl ?? null}
          imageModel={imageModel}
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

      <PromptDetailsModal
        details={promptDetailsImage?.promptDetails ?? null}
        isOpen={Boolean(promptDetailsImage)}
        onClose={() => setPromptDetailsImageId(null)}
        onCopy={handleCopyPromptText}
      />
    </div>
  );
}
