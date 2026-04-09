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
import { ApiError } from "@/lib/api-fetch";
import type { CardStatus } from "@/lib/constants";
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
};

export type CandidatePoolCardNode = Node<CandidatePoolCardData, "candidatePool">;

export function CandidatePoolCard({
  data,
  selected,
}: NodeProps<CandidatePoolCardNode>) {
  const { displayMode, groups, groupLabel, status = "idle" } = data;
  const latestVariantIndex = Math.max(...groups.map((group) => group.variantIndex), 0);

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
  const [actionError, setActionError] = useState<string | null>(null);

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

  const handleConfirmGroup = useCallback(async (groupId: string, confirmed: boolean, targetNodeId?: string) => {
    try {
      setActionError(null);
      setActionLoading(groupId);
      await confirmCandidateGroup(groupId, confirmed);
      void targetNodeId;
      dispatchWorkspaceInvalidated();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "更新定稿状态失败");
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
      {actionError ? (
        <div className="mb-3 rounded-lg bg-[#fdf2f2] px-3 py-2 text-xs text-[#c0392b]">
          {actionError}
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
                  onDelete={handleDeleteImage}
                  footer={
                    <>
                      <div className="flex items-center justify-between text-[10px] text-[var(--ink-400)]">
                        <span>第 {group.variantIndex} 组</span>
                        <span>{group.isConfirmed ? "已定稿" : "候选中"}</span>
                      </div>
                      <Button
                        variant="secondary"
                        className="h-7 px-2 text-[10px]"
                        onClick={() =>
                          handleConfirmGroup(
                            group.id,
                            !group.isConfirmed,
                            data.imageConfigId ? `finalized-${data.imageConfigId}` : undefined,
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
