"use client";

import { toCssAspectRatio } from "@/lib/utils";

import { LazyImage } from "@/components/ui/lazy-image";

import type { FinalizedImage } from "@/components/cards/finalized-pool-card";

export function FinalizedPreviewCard({
  image,
  compact = false,
  onPreview,
  onRegenerate,
  isRegenerating = false,
}: {
  image: FinalizedImage;
  compact?: boolean;
  onPreview: (image: FinalizedImage) => void;
  onRegenerate?: (image: FinalizedImage) => void;
  isRegenerating?: boolean;
}) {
  return (
    <div className={compact ? "overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5" : "overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2"}>
      <button
        type="button"
        className="relative w-full overflow-hidden rounded-lg bg-[var(--surface-dim)]"
        style={{ aspectRatio: toCssAspectRatio(image.aspectRatio) }}
        onClick={() => onPreview(image)}
      >
        {image.fileUrl ? (
          <LazyImage src={image.thumbnailUrl || image.fileUrl} alt="定稿预览" fill sizes="200px" className="object-contain" />
        ) : null}
      </button>
      <div className="mt-1.5">
        <p className="text-xs font-medium text-[var(--ink-default)]">{image.groupLabel ?? image.id}</p>
        <p className="text-xs text-[var(--ink-subtle)]">比例 {image.aspectRatio}</p>
        {onRegenerate ? (
          <button
            type="button"
            className="mt-1 text-xs text-[var(--brand-hover)] hover:text-[var(--brand-dark)] disabled:text-[var(--ink-subtle)]"
            disabled={isRegenerating}
            onClick={(e) => {
              e.stopPropagation();
              onRegenerate(image);
            }}
          >
            {isRegenerating ? "重新生成中..." : "重新生成"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
