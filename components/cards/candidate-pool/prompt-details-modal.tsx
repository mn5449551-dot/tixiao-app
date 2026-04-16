"use client";

import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export type PromptDetails = {
  promptText: string | null;
  negativePrompt: string | null;
  model: string | null;
  aspectRatio: string | null;
  referenceImages: Array<{ url: string }>;
  hasSnapshot: boolean;
  promptType?: string | null;
};

export function PromptDetailsModal({
  details,
  isOpen,
  onClose,
  onCopy,
}: {
  details: PromptDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onCopy: (label: string, value: string) => void;
}) {
  const hasSnapshot = details?.hasSnapshot ?? false;
  const promptText = hasSnapshot
    ? (details?.promptText?.trim() || "")
    : "该图片缺少历史生图快照，请重新生成后查看。";
  const negativePrompt = hasSnapshot
    ? (details?.negativePrompt?.trim() || "未传 negative prompt")
    : "该图片缺少历史生图快照，请重新生成后查看。";
  const referenceImages = hasSnapshot ? (details?.referenceImages ?? []) : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      scrollable
      title={details?.promptType === "delta" ? "差异提示词（基于第 1 张图的变化）" : "生图提示词"}
      description={details?.promptType === "delta" ? "此图基于第 1 张图通过图生图生成，以下为差异部分的描述。" : "查看该候选图真实传入模型的提示词与参考信息。"}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-[var(--surface-1)] p-4 text-sm">
          <div>
            <p className="text-[11px] text-[var(--ink-400)]">模型</p>
            <p className="mt-1 font-medium text-[var(--ink-900)]">{details?.model || "未记录模型"}</p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--ink-400)]">比例</p>
            <p className="mt-1 font-medium text-[var(--ink-900)]">{details?.aspectRatio || "未记录比例"}</p>
          </div>
        </div>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[var(--ink-900)]">正向提示词</h3>
            <Button
              variant="secondary"
              className="h-8 shrink-0 px-3 text-xs"
              disabled={!hasSnapshot}
              onClick={() => onCopy("正向提示词", promptText)}
            >
              复制
            </Button>
          </div>
          <pre className="whitespace-pre-wrap break-words rounded-2xl bg-[var(--surface-1)] p-4 text-sm leading-6 text-[var(--ink-800)]">
            {promptText}
          </pre>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[var(--ink-900)]">Negative Prompt</h3>
            <Button
              variant="secondary"
              className="h-8 shrink-0 px-3 text-xs"
              disabled={!hasSnapshot}
              onClick={() => onCopy("negative prompt", negativePrompt)}
            >
              复制
            </Button>
          </div>
          <pre className="whitespace-pre-wrap break-words rounded-2xl bg-[var(--surface-1)] p-4 text-sm leading-6 text-[var(--ink-800)]">
            {negativePrompt}
          </pre>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--ink-900)]">参考图</h3>
          {referenceImages.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {referenceImages.map((item) => {
                const isValidUrl = item.url.startsWith("/") || item.url.startsWith("http://") || item.url.startsWith("https://");
                return (
                  <div
                    key={item.url}
                    className="relative h-24 w-24 overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-2)]"
                  >
                    {isValidUrl ? (
                      <Image src={item.url} alt="参考图" fill sizes="96px" className="object-contain" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center p-2 text-center text-[10px] text-[var(--ink-500)]">
                        无效参考图地址
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--line-soft)] px-4 py-4 text-sm text-[var(--ink-500)]">
              {hasSnapshot ? "未传参考图" : "该图片缺少历史生图快照，请重新生成后查看。"}
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
