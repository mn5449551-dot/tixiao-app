"use client";

import type { CSSProperties, FormEvent, ReactElement } from "react";
import { startTransition, useState, useMemo, useCallback, useEffect } from "react";

import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ApiError, apiFetch } from "@/lib/api-fetch";
import { getDefaultDirectionGenerationInput } from "@/lib/workflow-defaults";
import { cn } from "@/lib/utils";
import { FEATURE_LIBRARY } from "@/lib/constants";
import { dispatchWorkspaceInvalidated } from "@/lib/workspace-events";

// -- Types -----------------------------------------------------------------

export type RequirementCardData = {
  businessGoal: string;
  targetAudience: string;
  formatType: string;
  feature: string;
  sellingPoints: string[];
  timeNode: string;
  directionCount: number;
};

export type RequirementCardNode = Node<
  { initial?: Partial<RequirementCardData>; projectId?: string },
  "requirementCard"
>;

// -- Helpers ---------------------------------------------------------------

function getFeatureLabel(idOrText: string) {
  return FEATURE_LIBRARY.find((f) => f.id === idOrText)?.name ?? idOrText;
}

function getSellingPointLabel(idOrText: string) {
  for (const feature of FEATURE_LIBRARY) {
    const sellingPoint = feature.sellingPoints.find((item) => item.id === idOrText);
    if (sellingPoint) return sellingPoint.label;
  }

  return idOrText;
}

function formatSellingPoints(values: string[]) {
  return values.map(getSellingPointLabel).join("\n");
}

function parseSellingPoints(value: string) {
  return value
    .split(/\n|[，,、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDefaultTimeNode(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 8 || month <= 2) return "期末冲刺";
  if (month >= 3 && month <= 4) return "期中考试";
  if (month === 5) return "期末考试";
  if (month === 6 || month === 7) return "暑假提升";
  return "开学季";
}

// -- Status helpers --------------------------------------------------------

type GenerationStatus = "idle" | "loading" | "done" | "error";

const statusConfig: Record<GenerationStatus, { label: string; tone: "brand" | "neutral" | "success" | "warning" }> = {
  idle: { label: "未生成", tone: "neutral" },
  loading: { label: "生成中", tone: "brand" },
  done: { label: "已完成", tone: "success" },
  error: { label: "失败", tone: "warning" },
};

const TARGET_AUDIENCE_OPTIONS = [
  { value: "parent", label: "家长" },
  { value: "student", label: "学生" },
] as const;

const DIRECTION_COUNT_OPTIONS = [1, 2, 3, 4, 5] as const;

function getRequirementErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

function getRequirementTopBarClass(status: GenerationStatus): string {
  if (status === "loading") {
    return "bg-gradient-to-r from-[var(--brand-300)] to-[var(--brand-500)]";
  }

  if (status === "done") {
    return "bg-gradient-to-r from-[var(--success-500)] to-[var(--success-700)]";
  }

  if (status === "error") {
    return "bg-gradient-to-r from-[var(--danger-500)] to-[var(--danger-700)]";
  }

  return "bg-gradient-to-r from-[var(--ink-200)] to-[var(--ink-300)]";
}

function getRequirementOptionClass(selected: boolean): string {
  return cn(
    "rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-200 active:scale-[0.97]",
    selected
      ? "border-[var(--brand-300)] bg-[var(--brand-50)] text-[var(--brand-700)] shadow-sm"
      : "border-[var(--line-strong)] bg-white text-[var(--ink-600)] hover:border-[var(--brand-300)] hover:bg-[var(--brand-50)]",
  );
}

function getDirectionCountButtonClass(selected: boolean): string {
  return cn(
    "flex h-11 w-11 items-center justify-center rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.95]",
    selected
      ? "bg-gradient-to-br from-[var(--brand-500)] to-[var(--brand-600)] text-white shadow-[0_4px_12px_rgba(230,126,58,0.3)]"
      : "bg-[var(--surface-1)] text-[var(--ink-600)] hover:bg-[var(--brand-50)] hover:text-[var(--brand-600)]",
  );
}

// -- Component -------------------------------------------------------------

export function RequirementCard({
  data,
  selected,
}: NodeProps<RequirementCardNode>): ReactElement {
  const initial = data.initial ?? {};

  const [businessGoal] = useState(initial.businessGoal ?? "app");
  const [targetAudience, setTargetAudience] = useState(initial.targetAudience ?? "");
  const [formatType] = useState(initial.formatType ?? "image_text");
  const [feature, setFeature] = useState(initial.feature ? getFeatureLabel(initial.feature) : "");
  const [sellingPointsText, setSellingPointsText] = useState(
    initial.sellingPoints ? formatSellingPoints(initial.sellingPoints) : "",
  );
  const [timeNode, setTimeNode] = useState(initial.timeNode ?? getDefaultTimeNode());
  const [directionCount, setDirectionCount] = useState(
    initial.directionCount ? String(initial.directionCount) : "3",
  );

  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sellingPoints = useMemo(
    () => parseSellingPoints(sellingPointsText),
    [sellingPointsText],
  );

  useEffect(() => {
    startTransition(() => {
      setTargetAudience(initial.targetAudience ?? "");
      setFeature(initial.feature ? getFeatureLabel(initial.feature) : "");
      setSellingPointsText(initial.sellingPoints ? formatSellingPoints(initial.sellingPoints) : "");
      setTimeNode(initial.timeNode ?? getDefaultTimeNode());
      setDirectionCount(initial.directionCount ? String(initial.directionCount) : "3");
    });
  }, [
    initial.targetAudience,
    initial.feature,
    initial.sellingPoints,
    initial.timeNode,
    initial.directionCount,
  ]);

  // -- Validation: 6 required fields ----------------------------------------

  const isFormValid = useMemo(() => {
    if (!targetAudience) return false;
    if (!feature.trim()) return false;
    if (sellingPoints.length === 0) return false;
    if (!timeNode) return false;
    const count = Number(directionCount);
    if (!Number.isInteger(count) || count < 1 || count > 5) return false;
    return true;
  }, [targetAudience, feature, sellingPoints, timeNode, directionCount]);

  // -- Submit ---------------------------------------------------------------

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!isFormValid) return;

      setStatus("loading");
      setErrorMessage(null);
      if (!data.projectId) {
        setStatus("error");
        setErrorMessage("项目信息缺失");
        return;
      }

      try {
        await apiFetch(`/api/projects/${data.projectId}/requirement`, {
          method: "POST",
          body: {
            business_goal: businessGoal,
            target_audience: targetAudience,
            format_type: formatType,
            feature,
            selling_points: sellingPoints,
            time_node: timeNode,
            direction_count: Number(directionCount),
          },
        });
      } catch (error) {
        setStatus("error");
        setErrorMessage(getRequirementErrorMessage(error, "需求保存失败，请重试"));
        return;
      }

      try {
        const defaults = getDefaultDirectionGenerationInput(targetAudience);
        await apiFetch(`/api/projects/${data.projectId}/directions/generate`, {
          method: "POST",
          body: {
            channel: defaults.channel,
            image_form: defaults.imageForm,
            copy_generation_count: 3,
          },
        });

        dispatchWorkspaceInvalidated();
        setStatus("done");
      } catch (error) {
        setStatus("error");
        setErrorMessage(getRequirementErrorMessage(error, "需求已保存，但方向生成失败，请重试"));
      }
    },
    [
      isFormValid,
      data.projectId,
      businessGoal,
      targetAudience,
      formatType,
      feature,
      sellingPoints,
      timeNode,
      directionCount,
    ],
  );

  const currentStatus = statusConfig[status];

  // -- Render ---------------------------------------------------------------

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-white p-6 shadow-[var(--shadow-card)] transition-all duration-350 ease-out",
        selected
          ? "border-[var(--brand-300)] ring-4 ring-[var(--brand-ring)] shadow-[var(--shadow-card-hover)]"
          : "border-[var(--line-soft)]",
      )}
      style={{ width: 420 } satisfies CSSProperties}
    >
      {/* Top color bar — wider and softer */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-2 transition-colors",
          getRequirementTopBarClass(status),
        )}
      />

      {/* Handles */}
      <Handle
        className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand-500)] !shadow-sm"
        position={Position.Left}
        type="target"
      />
      <Handle
        className="!h-3 !w-3 !border-2 !border-white !bg-[var(--brand-500)] !shadow-sm"
        position={Position.Right}
        type="source"
      />

      {/* Header */}
      <div className="workflow-drag-handle mb-6 flex cursor-grab items-center justify-between gap-3 border-b border-[var(--line-soft)] pb-4 active:cursor-grabbing">
        <div>
          <h3 className="text-lg font-semibold text-[var(--ink-950)]">需求卡</h3>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-[var(--ink-400)]">REQUIREMENT</p>
        </div>
        <Badge tone={currentStatus.tone} size="sm">{currentStatus.label}</Badge>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMessage ? (
          <div className="rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger-700)]">
            {errorMessage}
          </div>
        ) : null}
        <div className="space-y-5">
          {/* 业务目标 (disabled) */}
          <div className="rounded-2xl bg-[var(--surface-1)] p-4">
            <Field label="业务目标">
              <Input value="APP（本期固定）" disabled className="bg-transparent" />
            </Field>
          </div>

          {/* 目标人群 (required) */}
          <Field label="目标人群" hint="必填">
            <div className="grid grid-cols-2 gap-2.5">
              {TARGET_AUDIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTargetAudience(opt.value)}
                  className={getRequirementOptionClass(targetAudience === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          {/* 形式 (disabled) */}
          <div className="rounded-2xl bg-[var(--surface-1)] p-4">
            <Field label="形式">
              <Input value="图文（本期固定）" disabled className="bg-transparent" />
            </Field>
          </div>

          {/* 功能 (required) */}
          <Field label="功能" hint="必填">
            <Textarea
              value={feature}
              onChange={(e) => setFeature(e.target.value)}
              minRows={2}
              placeholder="例如：拍题精学"
              className="resize-none"
            />
          </Field>

          {/* 卖点 (required, free text) */}
          <Field label="卖点" hint="必填">
            <Textarea
              value={sellingPointsText}
              onChange={(e) => setSellingPointsText(e.target.value)}
              minRows={3}
              placeholder="例如：10 秒出解析&#10;像老师边写边讲"
              className="resize-none"
            />
          </Field>

          {/* 时间节点 (required) */}
          <Field label="时间节点" hint="必填">
            <Input
              value={timeNode}
              onChange={(e) => setTimeNode(e.target.value)}
              placeholder="例如：期中考试"
            />
          </Field>

          {/* 生成方向数量 */}
          <Field label="生成方向数量" hint="1-5个">
            <div className="flex gap-2.5">
              {DIRECTION_COUNT_OPTIONS.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setDirectionCount(String(num))}
                  className={getDirectionCountButtonClass(directionCount === String(num))}
                >
                  {num}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* Submit button */}
        <Button
          type="submit"
          variant="primary"
          disabled={!isFormValid || status === "loading"}
          className="w-full py-4 text-base font-semibold shadow-[var(--shadow-brand)] hover:shadow-[var(--shadow-brand-hover)]"
        >
          {status === "loading" ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
              生成中...
            </span>
          ) : (
            <><span className="mr-1.5">⚡</span> 保存并生成方向</>
          )}
        </Button>
      </form>
    </div>
  );
}
