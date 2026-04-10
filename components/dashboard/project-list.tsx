"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetchOk } from "@/lib/api-fetch";
import { formatRelativeDate } from "@/lib/utils";

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
      <Card className="flex min-h-[320px] items-center justify-center bg-white/88 p-10 text-center">
        <div className="max-w-md space-y-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--ink-400)]">Dashboard Empty</p>
          <h3 className="text-2xl font-semibold text-[var(--ink-900)]">还没有项目</h3>
          <p className="text-sm leading-7 text-[var(--ink-600)]">
            还没有项目，点击右上角新建一个。
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {projects.map((project, index) => (
        <div
          key={project.id}
          className="group flex items-center gap-3 rounded-2xl border border-[var(--line-soft)] bg-white/90 px-5 py-4 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--brand-300)] hover:bg-[var(--brand-50)] hover:shadow-[0_20px_50px_rgba(77,49,18,0.1)] animate-fade-in"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <Link href={`/projects/${project.id}`} className="flex-1">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold text-[var(--ink-950)] transition-colors group-hover:text-[var(--brand-700)]">
                  {project.title}
                </h3>
                <Badge tone={project.status === "draft" ? "neutral" : "brand"} size="sm">
                  {project.status === "draft" ? "草稿" : "进行中"}
                </Badge>
              </div>
              <p className="text-sm text-[var(--ink-500)]">
                图文 · 方向 <span className="font-medium text-[var(--ink-700)]">{project.directionCount}</span> 条 · 文案 <span className="font-medium text-[var(--ink-700)]">{project.copyCardCount}</span> 条
              </p>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xs text-[var(--ink-400)] border-l border-[var(--line-soft)] pl-3">
              {formatRelativeDate(project.updatedAt)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs text-[var(--ink-400)] hover:text-[var(--danger-700)] hover:bg-[var(--danger-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
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
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-1)] text-[var(--ink-400)] transition-all group-hover:bg-[var(--brand-500)] group-hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
              title="进入项目"
              aria-label="进入项目"
            >
              {'>'}
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
