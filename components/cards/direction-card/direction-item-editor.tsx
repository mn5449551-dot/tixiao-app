"use client";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";

export function DirectionItemEditor({
  labels,
  value,
  stageLabel,
  onChange,
  onCancel,
  onSave,
}: {
  labels: Record<string, string>;
  value: Record<string, string>;
  stageLabel?: string;
  onChange: (field: string, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-2">
      <Field label={labels.title}>
        <Textarea minRows={1} value={value.title ?? ""} onChange={(e) => onChange("title", e.target.value)} />
      </Field>
      <Field label={labels.targetAudience}>
        <Textarea
          minRows={1}
          value={value.targetAudience ?? ""}
          onChange={(e) => onChange("targetAudience", e.target.value)}
        />
      </Field>
      {stageLabel ? <DetailBlock label={labels.stage} value={stageLabel} /> : null}
      <Field label={labels.scenarioProblem}>
        <Textarea value={value.scenarioProblem ?? ""} onChange={(e) => onChange("scenarioProblem", e.target.value)} />
      </Field>
      <Field label={labels.differentiation}>
        <Textarea value={value.differentiation ?? ""} onChange={(e) => onChange("differentiation", e.target.value)} />
      </Field>
      <Field label={labels.effect}>
        <Textarea value={value.effect ?? ""} onChange={(e) => onChange("effect", e.target.value)} />
      </Field>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button variant="primary" onClick={onSave}>
          保存
        </Button>
      </div>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/70 px-3 py-2">
      <div className="text-[11px] font-medium leading-5 text-[var(--ink-500)]">{label}</div>
      <div className="mt-1 whitespace-pre-wrap break-words text-[var(--ink-900)]">{value}</div>
    </div>
  );
}
