"use client";

import Image from "next/image";

import { toCssAspectRatio } from "@/lib/utils";

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
    <div className={compact ? "overflow-hidden rounded-xl border border-[var(--line-soft)] bg-white p-1.5" : "overflow-hidden rounded-xl border border-[var(--line-soft)] bg-white p-2"}>
      <button
        type="button"
        className="relative w-full overflow-hidden rounded-lg bg-[var(--surface-2)]"
        style={{ aspectRatio: toCssAspectRatio(image.aspectRatio) }}
        onClick={() => onPreview(image)}
      >
        {image.fileUrl ? (
          <Image src={image.fileUrl} alt="定稿预览" fill sizes="200px" className="object-contain" />
        ) : null}
      </button>
      <div className="mt-1.5">
        <p className="text-xs font-medium text-[var(--ink-700)]">{image.groupLabel ?? image.id}</p>
        <p className="text-xs text-[var(--ink-400)]">比例 {image.aspectRatio}</p>
        {onRegenerate ? (
          <button
            type="button"
            className="mt-1 text-[10px] text-[var(--brand-600)] hover:text-[var(--brand-700)] disabled:text-[var(--ink-400)]"
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
