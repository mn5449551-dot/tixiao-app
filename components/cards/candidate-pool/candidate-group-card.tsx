"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { CandidateGroup } from "@/components/cards/candidate-pool-card";
import { CandidateImageCard } from "@/components/cards/candidate-pool/candidate-image-card";

export function CandidateGroupCard({
  group,
  displayMode,
  isLatest = false,
  modelLabel,
  loadingKey,
  onPreview,
  onInpaint,
  onRegenerate,
  onDeleteGroup,
  onConfirmGroup,
  onDiscardInpaint,
}: {
  group: CandidateGroup;
  displayMode: "double" | "triple";
  isLatest?: boolean;
  modelLabel?: string | null;
  loadingKey: string | null;
  onPreview: (id: string) => void;
  onInpaint: (id: string) => void;
  onRegenerate: (id: string) => void;
  onDeleteGroup: (id: string) => void;
  onConfirmGroup: () => void;
  onDiscardInpaint?: (id: string) => void;
}) {
  const groupHasGenerating = group.images.some((image) => image.status === "generating" || image.status === "pending");

  return (
    <div className="overflow-hidden rounded-[24px] border border-[var(--line-soft)] bg-white p-4 shadow-[var(--shadow-inset)]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[var(--ink-900)]">第 {group.variantIndex} 套{modelLabel ? <span className="font-normal text-[var(--ink-400)]"> · {modelLabel}</span> : ""}</p>
            {isLatest ? <Badge tone="neutral">最新</Badge> : null}
          </div>
          <p className="mt-1 text-[11px] text-[var(--ink-400)]">
            {displayMode === "double" ? "双图" : "三图"} · {group.aspectRatio} · {group.imageStyle}
          </p>
        </div>
        <Badge tone={group.isConfirmed ? "success" : groupHasGenerating ? "brand" : "neutral"}>
          {group.isConfirmed ? "已定稿" : groupHasGenerating ? "生成中" : "候选中"}
        </Badge>
      </div>
      <div className={cn("grid gap-3", displayMode === "double" ? "grid-cols-2" : "grid-cols-3")}>
        {group.images.map((image) => (
          <CandidateImageCard
            key={image.id}
            image={image}
            loadingKey={loadingKey}
            onPreview={onPreview}
            onInpaint={onInpaint}
            onRegenerate={onRegenerate}
            onDiscardInpaint={onDiscardInpaint}
            footer={
              <div className="flex items-center justify-between text-[10px] text-[var(--ink-400)]">
                <span>图 {image.slotIndex}</span>
                <span>{image.status === "done" ? "可预览" : image.status}</span>
              </div>
            }
          />
        ))}
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
