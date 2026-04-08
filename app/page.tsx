import { CreateProjectForm } from "@/components/dashboard/create-project-form";
import { ProjectList } from "@/components/dashboard/project-list";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listProjects } from "@/lib/project-data";

export default function HomePage() {
  const projects = listProjects();
  const totalDirections = projects.reduce((sum, project) => sum + project.directionCount, 0);
  const totalCopyCards = projects.reduce((sum, project) => sum + project.copyCardCount, 0);
  const activeProjects = projects.filter((project) => project.status === "active").length;

  const metrics = [
    { label: "项目总数", value: projects.length, hint: "当前数据库中的项目" },
    { label: "活跃项目", value: activeProjects, hint: "状态为 active" },
    { label: "方向总数", value: totalDirections, hint: "已生成方向卡数量" },
    { label: "文案卡总数", value: totalCopyCards, hint: "用于进入图文分支" },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1480px] flex-col gap-8 px-6 py-8">
      <section className="grid gap-6 rounded-[36px] border border-[var(--line-soft)] bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(248,241,236,0.88))] px-8 py-8 shadow-[var(--shadow-panel)] lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <Badge tone="brand">图文提效工作流</Badge>
          <div className="space-y-3">
            <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.05em] text-[var(--ink-950)]">
              面向运营同学的 AI 图文生产控制台
            </h1>
            <p className="max-w-3xl text-base leading-8 text-[var(--ink-600)]">
              本期聚焦 APP + 图文主链路：项目列表、三栏工作区、需求卡、方向卡、文案卡与图片配置。
              当前已落地新项目目录、数据库骨架、API Route 与 React Flow 工作区原型。
            </p>
          </div>
        </div>
        <CreateProjectForm />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="bg-white/92 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-400)]">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold text-[var(--ink-950)]">{metric.value}</p>
            <p className="mt-2 text-sm text-[var(--ink-500)]">{metric.hint}</p>
          </Card>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--ink-400)]">Dashboard</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">项目列表</h2>
          </div>
          <p className="text-sm text-[var(--ink-500)]">已接入本地 SQLite，支持真实创建 / 删除项目。</p>
        </div>
        <ProjectList projects={projects} />
      </section>
    </main>
  );
}
