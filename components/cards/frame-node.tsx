"use client";

import type { CSSProperties } from "react";

import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type FrameNodeData = {
  eyebrow: string;
  title: string;
  kind?: "direction" | "copy" | "imageConfig" | "candidate";
  status?: string;
  tone?: "brand" | "neutral" | "success" | "warning" | "danger";
  progress?: number;
  progressLabel?: string;
  lines: Array<{ label: string; value: string }>;
};

const toneBarClassName = {
  brand: "bg-[var(--brand-500)]",
  neutral: "bg-[#b0a89a]",
  success: "bg-[#6b8e23]",
  warning: "bg-[#c89a2b]",
  danger: "bg-[#c0392b]",
};

const nodeWidthMap: Record<NonNullable<FrameNodeData["kind"]>, number> = {
  direction: 380,
  copy: 320,
  imageConfig: 340,
  candidate: 480,
};

const iconMap: Record<NonNullable<FrameNodeData["kind"]>, string> = {
  direction: "🧭",
  copy: "✏️",
  imageConfig: "🖼️",
  candidate: "🗂️",
};

export function FrameNode({ data, selected }: NodeProps<Node<FrameNodeData, "frame">>) {
  const tone = data.tone ?? "neutral";
  const kind = data.kind ?? "imageConfig";
  const width = nodeWidthMap[kind];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border bg-white p-4 shadow-[var(--shadow-card)] transition",
        selected
          ? "border-[var(--brand-300)] ring-4 ring-[var(--brand-ring)]"
          : tone === "danger"
            ? "border-[#f4c7c3]"
            : "border-[var(--line-soft)]",
      )}
      style={{ width } satisfies CSSProperties}
    >
      <div className={cn("absolute inset-x-0 top-0 h-[4px]", toneBarClassName[tone])} />
      <Handle className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand-500)]" position={Position.Left} type="target" />
      <Handle className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand-500)]" position={Position.Right} type="source" />
      <div className="workflow-drag-handle mb-3 flex cursor-grab items-start justify-between gap-3 border-b border-[#f5f0eb] pb-3 pt-1 active:cursor-grabbing">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-400)]">{data.eyebrow}</p>
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{iconMap[kind]}</span>
            <h3 className="text-sm font-semibold text-[#4a3728]">{data.title}</h3>
          </div>
        </div>
        {data.status ? <Badge tone={mapToneToBadgeTone(tone)}>{data.status}</Badge> : null}
      </div>
      <div className="space-y-2 rounded-[22px] bg-[var(--surface-1)] p-3">
        {data.lines.map((line) => (
          <div key={`${line.label}-${line.value}`} className="grid grid-cols-[72px_1fr] gap-2 text-sm">
            <span className="text-[var(--ink-500)]">{line.label}</span>
            <span className="text-[var(--ink-900)]">{line.value}</span>
          </div>
        ))}
      </div>
      {typeof data.progress === "number" ? (
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-[var(--ink-500)]">
            <span>{data.progressLabel ?? "处理中"}</span>
            <span>{data.progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div
              className={cn("h-full rounded-full transition-all", toneBarClassName[tone])}
              style={{ width: `${data.progress}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function mapToneToBadgeTone(tone: FrameNodeData["tone"]): "neutral" | "brand" | "success" | "warning" {
  if (tone === "danger") return "warning";
  return tone ?? "neutral";
}
