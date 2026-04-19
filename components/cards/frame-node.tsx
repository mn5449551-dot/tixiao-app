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
  brand: "bg-[var(--brand)]",
  neutral: "bg-[var(--ink-disabled)]",
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--danger)]",
};

const nodeWidthMap: Record<NonNullable<FrameNodeData["kind"]>, number> = {
  direction: 400,
  copy: 440,
  imageConfig: 400,
  candidate: 480,
};

export function FrameNode({ data, selected }: NodeProps<Node<FrameNodeData, "frame">>) {
  const tone = data.tone ?? "neutral";
  const kind = data.kind ?? "imageConfig";
  const width = nodeWidthMap[kind];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] transition",
        selected
          ? "border-[var(--brand-light)] ring-2 ring-[var(--brand-ring)]"
          : tone === "danger"
            ? "border-[var(--danger)]"
            : "border-[var(--border)]",
      )}
      style={{ width } satisfies CSSProperties}
    >
      <div className={cn("absolute inset-x-0 top-0 h-1", toneBarClassName[tone])} />
      <Handle className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand)]" position={Position.Left} type="target" />
      <Handle className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand)]" position={Position.Right} type="source" />
      <div className="workflow-drag-handle mb-4 flex cursor-grab items-start justify-between gap-3 border-b border-[var(--border)] pb-3 pt-1 active:cursor-grabbing">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">{data.eyebrow}</p>
          <h3 className="text-xl font-semibold text-[var(--ink-strong)]">{data.title}</h3>
        </div>
        {data.status ? <Badge tone={mapToneToBadgeTone(tone)}>{data.status}</Badge> : null}
      </div>
      <div className="space-y-2 rounded-[var(--radius-md)] bg-[var(--surface-dim)] p-3">
        {data.lines.map((line) => (
          <div key={`${line.label}-${line.value}`} className="grid grid-cols-[72px_1fr] gap-2 text-sm">
            <span className="text-[var(--ink-subtle)]">{line.label}</span>
            <span className="text-[var(--ink-strong)]">{line.value}</span>
          </div>
        ))}
      </div>
      {typeof data.progress === "number" ? (
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--ink-subtle)]">
            <span>{data.progressLabel ?? "处理中"}</span>
            <span>{data.progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-dim)]">
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
