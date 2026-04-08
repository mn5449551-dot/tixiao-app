"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";

export function CreateProjectForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      setError(null);

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) {
        setError(payload.error ?? "新建项目失败");
        return;
      }

      setTitle("");
      router.push(`/projects/${payload.id}`);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-[28px] border border-[var(--line-soft)] bg-white/90 p-4 shadow-[var(--shadow-card)] backdrop-blur">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-[var(--ink-900)]">新建项目</p>
        <p className="text-xs text-[var(--ink-500)]">代码位于新目录 tixiao-app，文档与实现分离。</p>
      </div>
      <div className="flex gap-3">
        <Textarea
          minRows={1}
          placeholder="例如：Q2-期中冲刺拍题精学"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Button disabled={!title.trim() || isPending} onClick={handleSubmit}>
          {isPending ? "创建中..." : "新建项目"}
        </Button>
      </div>
      {error ? <p className="text-xs text-[var(--danger-700)]">{error}</p> : null}
    </div>
  );
}
