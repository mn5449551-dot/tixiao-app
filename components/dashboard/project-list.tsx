"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetchOk } from "@/lib/api-fetch";

type ProjectSummary = {
  id: string;
  title: string;
  status: string;
  directionCount: number;
  copyCardCount: number;
  updatedAt: number;
};

export function ProjectList({ projects }: { projects: ProjectSummary[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (projects.length === 0) {
    return (
      <Card className="flex min-h-[280px] items-center justify-center bg-white/90 p-10 text-center">
        <div className="max-w-md space-y-5">
          <h3 className="text-2xl font-semibold text-[var(--ink-strong)]">还没有项目</h3>
          <p className="text-sm leading-7 text-[var(--ink-default)]">还没有项目，点击右上角「新建项目」开始使用</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {projects.map((project, index) => (
        <div
          key={project.id}
          className="group animate-fade-in rounded-[26px] border border-[var(--border)] bg-white/92 px-5 py-4 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--brand-light)] hover:shadow-[var(--shadow-card-hover)] md:flex md:items-center md:justify-between"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <Link href={`/projects/${project.id}`} className="block min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold text-[var(--ink-strong)] transition-colors group-hover:text-[var(--brand-dark)]">
              {project.title}
            </h3>
          </Link>
          <div className="mt-3 flex items-center justify-end gap-3 md:mt-0 md:ml-6 md:shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs text-[var(--ink-muted)] opacity-40 transition-[opacity,color,background-color] group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)]"
              disabled={isPending}
              onClick={() => {
                if (!confirm(`确定删除项目「${project.title}」吗？此操作不可恢复。`)) return;
                startTransition(async () => {
                  const deleted = await apiFetchOk(`/api/projects/${project.id}`, { method: "DELETE" });
                  if (deleted) {
                    router.refresh();
                  }
                });
              }}
            >
              删除
            </Button>
            <Link
              href={`/projects/${project.id}`}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--ink-default)] transition-all hover:border-[var(--brand-light)] hover:bg-[var(--brand-bg)] hover:text-[var(--brand-dark)]"
              title="进入项目"
              aria-label="进入项目"
            >
              {"进入 >"}
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
