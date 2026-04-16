"use client";

import { Button } from "@/components/ui/button";
import { LazyImage } from "@/components/ui/lazy-image";
import { toCssAspectRatio } from "@/lib/utils";

import type { CandidateImage } from "@/components/cards/candidate-pool-card";

export function CandidateImageCard({
  image,
  selected,
  loadingKey,
  onToggleSelect,
  onPreview,
  onInpaint,
  onRegenerate,
  onViewPromptDetails,
  onDelete,
  onDiscardInpaint,
  footer,
}: {
  image: CandidateImage;
  selected?: boolean;
  loadingKey: string | null;
  onToggleSelect?: (id: string) => void;
  onPreview: (id: string) => void;
  onInpaint?: (id: string) => void;
  onRegenerate?: (id: string) => void;
  onViewPromptDetails?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDiscardInpaint?: (id: string) => void;
  footer?: React.ReactNode;
}) {
  const isGenerating = image.status === "generating" || image.status === "pending";
  const isFailed = image.status === "failed";
  const isDone = image.status === "done";
  const canViewPromptDetails = isDone && !image.inpaintParentId && Boolean(onViewPromptDetails);

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
          <LazyImage src={image.thumbnailUrl || image.fileUrl} alt={`候选图 ${image.slotIndex}`} fill sizes="240px" className="object-contain" />
        ) : isGenerating ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            <svg className="h-6 w-6 animate-spin text-[var(--brand-500)]" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-30" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span className="text-xs text-[var(--ink-400)]">生成中</span>
          </div>
        ) : isFailed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1">
            <span className="text-lg text-[#c0392b]">{"\u2716"}</span>
            <span className="text-xs font-medium text-[#c0392b]">生成失败</span>
          </div>
        ) : null}

        {isDone && onToggleSelect ? (
          <label className="absolute left-1.5 top-1.5 flex items-center gap-1">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(image.id)}
              className="h-3.5 w-3.5 accent-[var(--brand-500)]"
            />
          </label>
        ) : null}
      </button>
      <div className="space-y-2 p-3">
        {image.inpaintParentId && (
          <div className="flex items-center justify-between">
            <span className="inline-flex rounded bg-[var(--brand-50)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--brand-700)]">
              重绘版本
            </span>
            {onDiscardInpaint && (
              <Button variant="ghost" className="h-6 px-1.5 text-[10px] text-[var(--ink-400)]" onClick={() => onDiscardInpaint(image.id)}>
                放弃
              </Button>
            )}
          </div>
        )}
        {footer}
        <div className="flex flex-wrap gap-2">
          {canViewPromptDetails ? (
            <Button variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => onViewPromptDetails?.(image.id)}>
              查看提示词
            </Button>
          ) : null}
          {onInpaint ? (
            <Button variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => onInpaint(image.id)} disabled={!isDone}>
              重绘
            </Button>
          ) : null}
          {onRegenerate ? (
            <Button variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => onRegenerate(image.id)} disabled={loadingKey === image.id}>
              重生成
            </Button>
          ) : null}
          {onDelete ? (
            <Button variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => onDelete(image.id)} disabled={loadingKey === image.id}>
              删除
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
