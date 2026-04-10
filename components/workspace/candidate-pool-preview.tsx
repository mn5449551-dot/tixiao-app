"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { getProjectWorkspace } from "@/lib/project-data";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";

type WorkspaceData = NonNullable<ReturnType<typeof getProjectWorkspace>>;

type CandidateGroup = NonNullable<WorkspaceData["directions"][number]["copyCards"][number]["copies"][number]["groups"]>[number];
type CandidateImage = CandidateGroup["images"][number];

type SelectedImage = {
  image: CandidateImage;
  directionTitle: string;
  copyTitle: string;
  groupLabel: string;
};

export function CandidatePoolPreview({ workspace }: { workspace: WorkspaceData }) {
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [instruction, setInstruction] = useState("");

  const entries = useMemo(
    () =>
      workspace.directions.flatMap((direction) =>
        direction.copyCards.flatMap((card) =>
          card.copies
            .filter((copy) => copy.groups.length > 0)
            .map((copy) => ({
              directionTitle: direction.title,
              copyTitle: copy.titleMain,
              groups: copy.groups,
            })),
        ),
      ),
    [workspace.directions],
  );

  return (
    <>
      <section className="rounded-[24px] bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--ink-900)]">候选图池预览</h3>
            <p className="mt-1 text-xs text-[var(--ink-500)]">
              按方向和文案查看当前候选图组，也可以提前体验局部重绘界面。
            </p>
          </div>
          <Badge tone="brand">{entries.reduce((sum, item) => sum + item.groups.length, 0)} 组</Badge>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-[var(--line-soft)] bg-[var(--surface-1)] p-4 text-sm text-[var(--ink-500)]">
            完成图片配置并成功生成图片后，这里会出现真实候选图缩略图和局部重绘入口。
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <div
                key={`${entry.directionTitle}-${entry.copyTitle}`}
                className="space-y-2 rounded-[20px] border border-[var(--line-soft)] bg-[var(--surface-1)] p-3"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--ink-900)]">{entry.directionTitle}</p>
                  <p className="mt-1 text-xs text-[var(--ink-500)] line-clamp-2" title={entry.copyTitle}>{entry.copyTitle}</p>
                </div>
                <div className="grid gap-3">
                  {entry.groups.map((group) => (
                    <CandidateGroupCard
                      key={group.id}
                      copyTitle={entry.copyTitle}
                      directionTitle={entry.directionTitle}
                      group={group}
                      onOpenInpaint={(image) => {
                        setSelectedImage({
                          image,
                          directionTitle: entry.directionTitle,
                          copyTitle: entry.copyTitle,
                          groupLabel: `候选组 #${group.variantIndex}`,
                        });
                        setInstruction("");
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedImage ? (
        <InpaintModal
          instruction={instruction}
          selectedImage={selectedImage}
          setInstruction={setInstruction}
          onClose={() => setSelectedImage(null)}
        />
      ) : null}
    </>
  );
}

function CandidateGroupCard({
  group,
  directionTitle,
  copyTitle,
  onOpenInpaint,
}: {
  group: CandidateGroup;
  directionTitle: string;
  copyTitle: string;
  onOpenInpaint: (image: CandidateImage) => void;
}) {
  return (
    <div className="rounded-[18px] bg-white p-3 shadow-[var(--shadow-inset)]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-[var(--ink-700)]">候选组 #{group.variantIndex}</p>
          <p className="mt-1 text-[11px] text-[var(--ink-500)]">
            {directionTitle} · {copyTitle}
          </p>
        </div>
        <Badge tone={group.images.some((image) => image.status === "done") ? "success" : "warning"}>
          {group.slotCount} 张
        </Badge>
      </div>
      <div
        className={`grid gap-2 ${
          group.slotCount >= 3 ? "grid-cols-3" : group.slotCount === 2 ? "grid-cols-2" : "grid-cols-1"
        }`}
      >
        {group.images.map((image) => (
          <div key={image.id} className="overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-[#f7f3ef]">
            {image.fileUrl ? (
              <Image
                alt={`候选图 ${image.slotIndex}`}
                className="aspect-[4/3] w-full object-cover"
                height={240}
                src={image.fileUrl}
                unoptimized
                width={320}
              />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center bg-[linear-gradient(135deg,#fff7ed,#f4e3d7)] text-xs text-[var(--ink-500)]">
                {image.status}
              </div>
            )}
            <div className="space-y-2 px-2 py-2 text-[11px] text-[var(--ink-500)]">
              <div className="flex items-center justify-between">
                <p>slot {image.slotIndex}</p>
                <p>seed {image.seed ?? "-"}</p>
              </div>
              <Button
                className="h-8 w-full rounded-xl text-xs"
                disabled={!image.fileUrl}
                variant="secondary"
                onClick={() => onOpenInpaint(image)}
              >
                局部重绘
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InpaintModal({
  selectedImage,
  instruction,
  setInstruction,
  onClose,
}: {
  selectedImage: SelectedImage;
  instruction: string;
  setInstruction: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6 backdrop-blur-sm">
      <div className="grid max-h-[90vh] w-full max-w-6xl grid-cols-[1.4fr_0.9fr] gap-5 overflow-hidden rounded-[32px] border border-[var(--line-soft)] bg-[var(--surface-0)] p-5 shadow-[0_40px_120px_rgba(0,0,0,0.25)]">
        <div className="space-y-4 overflow-hidden rounded-[24px] bg-white p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-400)]">Inpaint Preview</p>
              <h3 className="mt-1 text-lg font-semibold text-[var(--ink-900)]">局部重绘画布</h3>
            </div>
            <Badge tone="warning">API 未接入</Badge>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-[var(--line-soft)] bg-[var(--surface-1)]">
            <Image
              alt="待重绘图片"
              className="h-auto w-full object-contain"
              height={720}
              src={selectedImage.image.fileUrl ?? ""}
              unoptimized
              width={960}
            />
          </div>

          <div className="grid gap-3 rounded-[20px] border border-dashed border-[var(--line-soft)] bg-[var(--surface-1)] p-4 md:grid-cols-[1fr_auto]">
            <div>
              <p className="text-sm font-medium text-[var(--ink-900)]">蒙版绘制区（界面预留）</p>
              <p className="mt-1 text-xs leading-5 text-[var(--ink-500)]">
                后续接入真实 inpaint API 后，这里会支持画笔/橡皮擦、遮罩可视化和局部区域重绘。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled variant="secondary">画笔</Button>
              <Button disabled variant="ghost">橡皮擦</Button>
              <Button disabled variant="ghost">清空遮罩</Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto rounded-[24px] bg-white p-4 shadow-[var(--shadow-card)]">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-400)]">Inpaint Control</p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--ink-900)]">重绘控制面板</h3>
            <p className="mt-2 text-sm text-[var(--ink-500)]">
              当前先完成界面与交互结构，等后端 inpaint API 就绪后直接接入。
            </p>
          </div>

          <div className="rounded-[20px] bg-[var(--surface-1)] p-4 text-sm text-[var(--ink-700)]">
            <p><span className="font-medium">方向：</span>{selectedImage.directionTitle}</p>
            <p className="mt-1"><span className="font-medium">文案：</span>{selectedImage.copyTitle}</p>
            <p className="mt-1"><span className="font-medium">来源：</span>{selectedImage.groupLabel} / slot {selectedImage.image.slotIndex}</p>
          </div>

          <Field label="重绘指令" hint="后续会直接作为 inpaint_instruction 发送">
            <Textarea
              placeholder="例如：把背景改成教室，把右下角人物换成手持练习册的学生，保留整体排版。"
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
            />
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Button disabled variant="secondary">小画笔</Button>
            <Button disabled variant="secondary">中画笔</Button>
            <Button disabled variant="secondary">大画笔</Button>
          </div>

          <div className="rounded-[20px] border border-[#fed7aa] bg-[#fff7ed] p-4 text-sm leading-6 text-[#9b6513]">
            暂未接入局部重绘 API。等接口可用后，这个面板会直接调用真实接口，不会重做界面。
          </div>

          <div className="mt-auto flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>关闭</Button>
            <Button disabled={!instruction.trim()}>提交重绘（暂不可用）</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
