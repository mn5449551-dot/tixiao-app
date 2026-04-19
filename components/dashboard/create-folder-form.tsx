"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ApiError, apiFetch } from "@/lib/api-fetch";

export function CreateFolderForm({ existingNames = [] }: { existingNames?: string[] }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClose = () => {
    setIsOpen(false);
    setName("");
    setError(null);
  };

  const handleSubmit = () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("文件夹名称不能为空");
      return;
    }

    if (existingNames.some((n) => n === trimmedName)) {
      setError("已存在同名文件夹");
      return;
    }

    startTransition(async () => {
      setError(null);

      try {
        await apiFetch("/api/folders", {
          method: "POST",
          body: { name: trimmedName },
        });

        handleClose();
        router.refresh();
      } catch (error) {
        setError(error instanceof ApiError ? error.message : "创建文件夹失败");
      }
    });
  };

  return (
    <>
      <Button variant="primary" size="lg" onClick={() => setIsOpen(true)} className="w-full justify-center lg:w-auto shadow-[var(--shadow-brand)] hover:shadow-[var(--shadow-brand-hover)]">
        <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        新建文件夹
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="新建文件夹"
        description="创建一个项目文件夹，按人员或项目类型分组管理。"
      >
        <div className="space-y-4">
          <Input
            autoFocus
            placeholder="例如：小王的项目"
            maxLength={50}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) {
                setError(null);
              }
            }}
          />
          {error ? (
            <div className="rounded-2xl bg-[var(--danger-bg)] px-4 py-3">
              <p className="text-sm text-[var(--danger-text)]">{error}</p>
            </div>
          ) : null}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleClose}>
              取消
            </Button>
            <Button disabled={isPending} onClick={handleSubmit}>
              {isPending ? "创建中..." : "创建文件夹"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
