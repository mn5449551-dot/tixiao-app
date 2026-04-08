"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
        <div className="max-w-md space-y-4">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--ink-400)]">Dashboard Empty</p>
          <h3 className="text-2xl font-semibold text-[var(--ink-900)]">还没有项目</h3>
          <p className="text-sm leading-6 text-[var(--ink-600)]">
            还没有项目，点击右上角新建一个。
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {projects.map((project) => (
        <div
          key={project.id}
          className="group flex items-center gap-3 rounded-[20px] border border-[var(--line-soft)] bg-white/92 px-5 py-4 shadow-[var(--shadow-card)] transition hover:border-[var(--brand-300)] hover:bg-[var(--brand-50)]"
        >
          <Link href={`/projects/${project.id}`} className="flex-1">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold text-[var(--ink-950)]">{project.title}</h3>
                <Badge tone="neutral">{project.status === "draft" ? "草稿" : "进行中"}</Badge>
              </div>
              <p className="text-sm text-[var(--ink-500)]">
                图文 · 方向 {project.directionCount} 条 · 文案 {project.copyCardCount} 条
              </p>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xs text-[var(--ink-400)]">{formatRelativeDate(project.updatedAt)}</span>
            <Button
              variant="ghost"
              className="h-7 px-2 text-xs text-[var(--ink-400)]"
              disabled={isPending}
              onClick={() => {
                if (!confirm(`确定删除项目「${project.title}」吗？此操作不可恢复。`)) return;
                startTransition(async () => {
                  await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
                  router.refresh();
                });
              }}
            >
              删除
            </Button>
            <Link
              href={`/projects/${project.id}`}
              className="text-lg text-[var(--ink-400)] transition group-hover:text-[var(--brand-500)]"
            >
              {"\u2192"}
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
