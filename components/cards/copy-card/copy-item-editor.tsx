"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";

export function CopyItemEditor({
  rows,
  value,
  locked,
  onChange,
  onCancel,
  onSave,
}: {
  rows: Array<{ label: string; value: string }>;
  value: { main: string; sub: string; extra: string } | undefined;
  locked: boolean;
  onChange: (field: "main" | "sub" | "extra", value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (locked) {
    return <p className="text-[11px] text-[var(--ink-400)]">已锁定，需先删除对应图片配置卡才能修改</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <label key={row.label} className="grid grid-cols-[64px_1fr] items-center gap-2 text-[11px] text-[var(--ink-600)]">
          <span>{row.label}：</span>
          <Textarea
            minRows={1}
            className="rounded-xl px-2.5 py-2 text-xs focus:ring-2"
            value={
              row.label === "主标题" || row.label === "图1文案"
                ? (value?.main ?? row.value)
                : row.label === "副标题" || row.label === "图2文案"
                  ? (value?.sub ?? row.value)
                  : row.label === "图3文案"
                    ? (value?.extra ?? row.value)
                    : row.value
            }
            disabled={row.label === "图间关系"}
            onChange={(e) => {
              if (row.label === "主标题" || row.label === "图1文案") onChange("main", e.target.value);
              else if (row.label === "副标题" || row.label === "图2文案") onChange("sub", e.target.value);
              else if (row.label === "图3文案") onChange("extra", e.target.value);
            }}
          />
        </label>
      ))}
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
