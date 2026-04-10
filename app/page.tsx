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
    <main id="main-content" className="relative mx-auto flex min-h-screen w-full max-w-[1520px] flex-col gap-10 px-8 py-10">
      {/* ═══ Background Decorative Elements ═══ */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(246,126,46,0.04),transparent_70%)] blur-3xl" />
        <div className="absolute -right-32 top-1/4 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(232,107,94,0.03),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(254,221,195,0.05),transparent_70%)] blur-2xl" />
      </div>

      {/* ═══ Hero Section — Editorial Layout ═══ */}
      <section className="animate-fade-in-up relative overflow-hidden rounded-[36px] border border-[var(--line-soft)] bg-white/80 px-10 py-10 shadow-[var(--shadow-panel)] backdrop-blur-sm lg:grid lg:grid-cols-[1.3fr_0.7fr] lg:gap-10">
        {/* Decorative corner accent */}
        <div className="absolute left-0 top-0 h-24 w-24 overflow-hidden">
          <div className="absolute -left-1 -top-1 h-12 w-12 rounded-br-3xl bg-gradient-to-br from-[var(--brand-400)] to-[var(--brand-500)] opacity-80" />
        </div>

        <div className="relative z-10 space-y-6">
          <Badge tone="brand" size="sm" className="animate-fade-in stagger-1">
            图文提效工作流
          </Badge>

          <div className="space-y-4">
            <h1 className="animate-fade-in stagger-2 text-4xl font-semibold tracking-tight text-[var(--ink-950)] lg:text-5xl">
              面向运营同学的
              <span className="relative inline-block px-2">
                <span className="absolute bottom-1 left-0 right-0 h-3 bg-[var(--brand-100)] opacity-60" />
                <span className="relative">AI 图文生产控制台</span>
              </span>
            </h1>

            <p className="animate-fade-in stagger-3 max-w-2xl text-base leading-8 text-[var(--ink-600)]">
              本期聚焦 APP + 图文主链路：项目列表、三栏工作区、需求卡、方向卡、文案卡与图片配置。
              当前已落地新项目目录、数据库骨架、API Route 与 React Flow 工作区原型。
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-8 lg:mt-0">
          <div className="animate-scale-in stagger-4">
            <CreateProjectForm />
          </div>
        </div>

        {/* Subtle bottom gradient line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--brand-200)] to-transparent opacity-50" />
      </section>

      {/* ═══ Metrics Section — Refined Cards ═══ */}
      <section className="animate-fade-in-up grid gap-4 md:grid-cols-2 xl:grid-cols-4" style={{ animationDelay: "150ms" }}>
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className="group animate-fade-in"
            style={{ animationDelay: `${200 + index * 80}ms` }}
          >
            <Card className="relative overflow-hidden bg-white/90 px-6 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]">
              {/* Subtle brand accent on hover */}
              <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-[var(--brand-400)] to-[var(--brand-500)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--ink-400)]">
                {metric.label}
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ink-950)]">
                {metric.value}
              </p>
              <p className="mt-2 text-xs text-[var(--ink-500)]">{metric.hint}</p>
            </Card>
          </div>
        ))}
      </section>

      {/* ═══ Project List Section ═══ */}
      <section className="animate-fade-in-up space-y-4" style={{ animationDelay: "400ms" }}>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--ink-400)]">
              Dashboard
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">项目列表</h2>
          </div>
          <p className="max-w-sm text-sm text-[var(--ink-500)]">
            已接入本地 SQLite，支持真实创建 / 删除项目。
          </p>
        </div>
        <ProjectList projects={projects} />
      </section>
    </main>
  );
}
