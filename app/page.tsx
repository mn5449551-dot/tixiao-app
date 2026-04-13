import Link from "next/link";

import { CreateProjectForm } from "@/components/dashboard/create-project-form";
import { ProjectList } from "@/components/dashboard/project-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listProjects } from "@/lib/project-data";

export default function HomePage() {
  const projects = listProjects();
  const totalDirections = projects.reduce((sum, project) => sum + project.directionCount, 0);
  const totalCopyCards = projects.reduce((sum, project) => sum + project.copyCardCount, 0);
  const activeProjects = projects.filter((project) => project.status === "active").length;

  const metrics = [
    { label: "项目总数", value: projects.length, accent: "from-[var(--brand-200)] to-transparent" },
    { label: "活跃项目", value: activeProjects, accent: "from-[var(--accent-300)] to-transparent" },
    { label: "方向卡总数", value: totalDirections, accent: "from-[var(--brand-300)] to-transparent" },
    { label: "文案卡总数", value: totalCopyCards, accent: "from-[var(--accent-300)] to-transparent" },
  ];

  return (
    <main id="main-content" className="relative mx-auto flex min-h-screen w-full max-w-[1520px] flex-col gap-10 px-8 py-10">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(246,126,46,0.04),transparent_70%)] blur-3xl" />
        <div className="absolute -right-32 top-1/4 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(232,107,94,0.03),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(254,221,195,0.05),transparent_70%)] blur-2xl" />
      </div>

      <section className="animate-fade-in-up relative overflow-hidden rounded-[36px] border border-[var(--line-soft)] bg-white/82 px-8 py-8 shadow-[var(--shadow-panel)] backdrop-blur-sm lg:flex lg:items-center lg:justify-between lg:px-10 lg:py-10">
        <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_top_right,rgba(246,126,46,0.12),transparent_72%)]" />
        <div className="relative z-10 space-y-5">
          <Badge tone="brand" size="sm" className="animate-fade-in stagger-1">
            图文提效工作台
          </Badge>
          <div className="space-y-3">
            <h1 className="animate-fade-in stagger-2 text-4xl font-semibold tracking-tight text-[var(--ink-950)] lg:text-5xl">
              AI 图文生产工作台
            </h1>
            <p className="animate-fade-in stagger-3 max-w-2xl text-base leading-8 text-[var(--ink-600)]">
              集中管理您的 AI 图文创作项目与素材资产。
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-6 animate-scale-in stagger-4 lg:mt-0 lg:shrink-0 lg:flex lg:items-center lg:gap-3">
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              设置
            </Button>
          </Link>
          <CreateProjectForm />
        </div>
      </section>

      <section className="animate-fade-in-up grid gap-4 md:grid-cols-2 xl:grid-cols-4" style={{ animationDelay: "150ms" }}>
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className="group animate-fade-in"
            style={{ animationDelay: `${200 + index * 80}ms` }}
          >
            <Card className="relative overflow-hidden bg-white/92 px-6 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]">
              <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-br ${metric.accent} opacity-70`} />
              <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ink-950)]">
                {metric.value}
              </p>
              <p className="mt-2 text-sm text-[var(--ink-500)]">{metric.label}</p>
            </Card>
          </div>
        ))}
      </section>

      <section className="animate-fade-in-up space-y-4" style={{ animationDelay: "400ms" }}>
        <h2 className="text-2xl font-semibold text-[var(--ink-950)]">项目列表</h2>
        <ProjectList projects={projects} />
      </section>
    </main>
  );
}
