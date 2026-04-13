"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ApiError, apiFetch } from "@/lib/api-fetch";

export function CreateProjectForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClose = () => {
    setIsOpen(false);
    setTitle("");
    setError(null);
  };

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

        handleClose();
        router.push(`/projects/${payload.id}`);
        router.refresh();
      } catch (error) {
        setError(error instanceof ApiError ? error.message : "新建项目失败");
      }
    });
  };

  return (
    <>
      <Button size="lg" onClick={() => setIsOpen(true)} className="w-full justify-center lg:w-auto">
        ＋ 新建项目
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="新建项目"
        description="输入项目名称后即可进入工作台继续编辑。"
      >
        <div className="space-y-4">
          <Input
            autoFocus
            placeholder="例如：Q2-期中冲刺拍题精学"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (error) {
                setError(null);
              }
            }}
          />
          {error ? (
            <div className="rounded-2xl bg-[var(--danger-soft)] px-4 py-3">
              <p className="text-sm text-[var(--danger-700)]">{error}</p>
            </div>
          ) : null}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleClose}>
              取消
            </Button>
            <Button disabled={isPending} onClick={handleSubmit}>
              {isPending ? "创建中..." : "创建项目"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
