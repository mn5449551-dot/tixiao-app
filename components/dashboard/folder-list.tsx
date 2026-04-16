"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { apiFetchOk } from "@/lib/api-fetch";
import { formatRelativeDate } from "@/lib/utils";

type FolderSummary = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

export function FolderList({ folders }: { folders: FolderSummary[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {folders.map((folder, index) => (
        <div
          key={folder.id}
          className="group animate-fade-in rounded-[26px] border border-[var(--line-soft)] bg-white/92 px-5 py-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--line-brand)] hover:shadow-[var(--shadow-card-hover)] md:flex md:items-center md:justify-between"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <Link href={`/folders/${folder.id}`} className="block min-w-0 flex-1">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xl">{"\uD83D\uDCC1"}</span>
                <h3 className="truncate text-xl font-semibold text-[var(--ink-950)] transition-colors group-hover:text-[var(--brand-700)]">
                  {folder.name}
                </h3>
              </div>
              <p className="text-sm text-[var(--ink-500)]">
                项目文件夹 · {formatRelativeDate(folder.updatedAt)}
              </p>
            </div>
          </Link>
          <div className="mt-4 flex items-center justify-end gap-3 md:mt-0 md:ml-6 md:shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs text-[var(--ink-500)] opacity-40 transition-[opacity,color,background-color] group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[var(--danger-soft)] hover:text-[var(--danger-700)]"
              disabled={isPending}
              onClick={() => {
                if (!confirm(`确定删除文件夹「${folder.name}」吗？会同时永久删除该文件夹下的全部项目和素材，无法恢复。`)) return;
                startTransition(async () => {
                  const deleted = await apiFetchOk(`/api/folders/${folder.id}`, { method: "DELETE" });
                  if (deleted) {
                    router.refresh();
                  }
                });
              }}
            >
              删除
            </Button>
            <Link
              href={`/folders/${folder.id}`}
              className="inline-flex items-center rounded-xl bg-gradient-to-br from-[var(--brand-400)] to-[var(--brand-500)] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(232,131,90,0.3)]"
              title="打开文件夹"
              aria-label="打开文件夹"
            >
              进入
              <svg className="ml-1 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
