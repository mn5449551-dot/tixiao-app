"use client";

import dynamic from "next/dynamic";
import type { CSSProperties, ReactElement } from "react";
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
import { PromptDetailsModal } from "@/components/cards/candidate-pool/prompt-details-modal";
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
  thumbnailUrl?: string | null;
  status: "pending" | "generating" | "done" | "failed";
  errorMessage?: string | null;
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
  imageModel: string | null;
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

function getCandidatePoolBorderClass(status: CardStatus, selected: boolean): string {
  if (status === "error") return "border-[var(--danger)]";
  if (status === "partial-success") return "border-[var(--brand)]";
  if (selected) return "border-[var(--brand-light)] ring-2 ring-[var(--brand-ring)]";
  return "border-[var(--border)]";
}

function getCandidatePoolTopBarClass(status: CardStatus): string {
  if (status === "error") return "bg-[var(--danger)]";
  if (status === "partial-success") return "bg-[var(--brand)]";
  return "bg-[var(--brand)]";
}

function getCandidatePoolSummaryText(
  displayMode: CandidatePoolCardData["displayMode"],
  groups: CandidateGroup[],
  images: CandidateImage[],
  doneCount: number,
): string {
  const totalText = displayMode === "single" ? `${images.length}张` : `${groups.length}套`;
  return `共${totalText} · 可用${doneCount}张`;
}

export function CandidatePoolCard({
  data,
  selected,
}: NodeProps<CandidatePoolCardNode>): ReactElement {
  const { displayMode, groups, groupLabel, status = "idle", imageModel } = data;
  const getModelLabel = useCallback((model: string | null | undefined) =>
    model ? (IMAGE_MODELS.find((m) => m.value === model)?.label ?? model) : null,
  []);
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
  const previewImage = useMemo(
    () => (previewImageId ? images.find((img) => img.id === previewImageId) ?? null : null),
    [images, previewImageId],
  );
  const inpaintImage = useMemo(
    () => (inpaintImageId ? images.find((img) => img.id === inpaintImageId) ?? null : null),
    [images, inpaintImageId],
  );
  const isDone = status === "done";
  const doneCount = images.filter((img) => img.status === "done").length;
  const borderColorClass = getCandidatePoolBorderClass(status, selected);

  const runCandidateAction = useCallback(async (
    loadingKey: string,
    action: () => Promise<unknown>,
    fallbackMessage: string,
  ): Promise<void> => {
    try {
      setActionError(null);
      setActionLoading(loadingKey);
      await action();
      dispatchWorkspaceInvalidated();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : fallbackMessage);
    } finally {
      setActionLoading(null);
    }
  }, []);

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
    await runCandidateAction(imageId, () => deleteCandidateImage(imageId), "删除图片失败");
  }, [runCandidateAction]);

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    await runCandidateAction(groupId, () => deleteCandidateGroup(groupId), "删除候选组失败");
  }, [runCandidateAction]);

  const handleRegenerateImage = useCallback(async (imageId: string) => {
    await runCandidateAction(imageId, () => regenerateCandidateImage(imageId), "重生成失败");
  }, [runCandidateAction]);

  const handleDiscardInpaint = useCallback(async (imageId: string) => {
    await runCandidateAction(imageId, () => deleteCandidateImage(imageId), "放弃重绘失败");
  }, [runCandidateAction]);

  const handleConfirmGroup = useCallback(async (groupId: string, confirmed: boolean) => {
    await runCandidateAction(groupId, () => confirmCandidateGroup(groupId, confirmed), "更新定稿状态失败");
  }, [runCandidateAction]);

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
        "relative overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] transition",
        borderColorClass,
      )}
      style={{ width: 480, maxWidth: '100%' } satisfies CSSProperties}
    >
      <div className={cn(
        "absolute inset-x-0 top-0 h-1",
        getCandidatePoolTopBarClass(status),
      )} />

      <Handle
        className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand)]"
        position={Position.Left}
        type="target"
      />
      <Handle
        className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand)]"
        position={Position.Right}
        type="source"
      />

      <div className="workflow-drag-handle mb-4 flex cursor-grab items-start justify-between gap-3 border-b border-[var(--border)] pb-3 pt-1 active:cursor-grabbing">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-[var(--ink-strong)]">候选图池</h3>
            {isDone && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--success)] text-white text-xs">{"\u2713"}</span>
            )}
          </div>
          <p className="text-xs text-[var(--ink-muted)]">
            {getCandidatePoolSummaryText(displayMode, groups, images, doneCount)}
          </p>
        </div>
        {groupLabel ? <Badge tone="neutral">{groupLabel}</Badge> : null}
      </div>

      {actionError ? (
        <div className="mb-3 rounded-lg bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger-text)]">
          {actionError}
        </div>
      ) : null}

      {copyFeedback ? (
        <div className="mb-3 rounded-lg bg-[var(--surface-dim)] px-3 py-2 text-xs text-[var(--ink-subtle)]">
          {copyFeedback}
        </div>
      ) : null}

      <div className="space-y-3 rounded-[var(--radius-md)] bg-[var(--surface-dim)] p-3">
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
                  onInpaint={group.isConfirmed ? undefined : setInpaintImageId}
                  onRegenerate={group.isConfirmed ? undefined : handleRegenerateImage}
                  onViewPromptDetails={setPromptDetailsImageId}
                  onDelete={group.isConfirmed ? undefined : handleDeleteImage}
                  onDiscardInpaint={group.isConfirmed ? undefined : handleDiscardInpaint}
                  footer={
                    <>
                      <div className="flex items-center justify-between text-xs text-[var(--ink-muted)]">
                        <span>第 {group.variantIndex} 组{getModelLabel(group.imageModel) ? ` · ${getModelLabel(group.imageModel)}` : ""}</span>
                        <span>{group.isConfirmed ? "已定稿" : "候选中"}</span>
                      </div>
                      <Button
                        variant="secondary"
                        className="h-7 px-2 text-xs"
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
                modelLabel={getModelLabel(group.imageModel)}
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
          <span className="flex-1 text-center text-xs text-[var(--ink-muted)]">
            已选 {selectedIds.size}/{doneCount}
          </span>
        </div>
      ) : null}

      {inpaintImageId && (
        <InpaintModal
          imageId={inpaintImageId}
          imageUrl={inpaintImage?.fileUrl ?? null}
          imageModel={imageModel}
          onClose={() => setInpaintImageId(null)}
        />
      )}

      {previewImageId ? (
        <ImagePreviewModal
          imageUrl={previewImage?.fileUrl ?? null}
          title="候选图预览"
          aspectRatio={previewImage?.aspectRatio}
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
