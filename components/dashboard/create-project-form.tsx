"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { ApiError, apiFetch } from "@/lib/api-fetch";

export function CreateProjectForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError("项目标题不能为空");
      return;
    }

    startTransition(async () => {
      setError(null);

      try {
        const payload = await apiFetch<{ id?: string }>("/api/projects", {
          method: "POST",
          body: { title: trimmedTitle },
        });

        if (!payload?.id) {
          setError("新建项目失败");
          return;
        }

        setTitle("");
        router.push(`/projects/${payload.id}`);
        router.refresh();
      } catch (error) {
        setError(error instanceof ApiError ? error.message : "新建项目失败");
        return;
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-[28px] border border-[var(--line-soft)] bg-white/90 p-4 shadow-[var(--shadow-card)] backdrop-blur transition-all duration-200 hover:shadow-[var(--shadow-panel)]">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-[var(--ink-900)]">新建项目</p>
        <p className="text-xs text-[var(--ink-500)]">代码位于新目录 tixiao-app，文档与实现分离。</p>
      </div>
      <div className="flex gap-3">
        <Textarea
          minRows={1}
          placeholder="例如：Q2-期中冲刺拍题精学"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (error) {
              setError(null);
            }
          }}
        />
        <Button 
          disabled={isPending} 
          onClick={handleSubmit}
          className="shrink-0"
        >
          {isPending ? (
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              创建中...
            </span>
          ) : (
            "新建项目"
          )}
        </Button>
      </div>
      {error && (
        <div className="rounded-lg bg-[var(--danger-soft)] px-3 py-2">
          <p className="text-xs text-[var(--danger-700)]">{error}</p>
        </div>
      )}
    </div>
  );
}
