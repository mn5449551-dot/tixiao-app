"use client";

import Image from "next/image";

import { toCssAspectRatio } from "@/lib/utils";

export function ImagePreviewModal({
  imageUrl,
  title,
  aspectRatio,
  onClose,
}: {
  imageUrl: string | null;
  title: string;
  aspectRatio?: string;
  onClose: () => void;
}) {
  if (!imageUrl) return null;

  const resolvedAspectRatio = toCssAspectRatio(aspectRatio);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      <div
        className="pointer-events-auto relative w-full max-w-[min(92vw,1400px)]"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line-soft)] bg-white/92 text-sm font-medium text-[var(--ink-700)] shadow-[var(--shadow-card)] transition hover:bg-white"
          title="关闭预览"
        >
          ×
        </button>
        <div
          className="relative overflow-hidden rounded-[20px] border border-[var(--line-soft)] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.16)]"
          style={{
            aspectRatio: resolvedAspectRatio,
            maxHeight: "78vh",
          }}
        >
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="90vw"
            className="object-contain"
            unoptimized
          />
        </div>
      </div>
    </div>
  );
}

