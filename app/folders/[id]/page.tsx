import Link from "next/link";

import { CreateProjectForm } from "@/components/dashboard/create-project-form";
import { ProjectList } from "@/components/dashboard/project-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { projectFolders } from "@/lib/schema";
import { listProjects } from "@/lib/project-data";
import { eq } from "drizzle-orm";

export default async function FolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const db = getDb();
  const folder = db.select().from(projectFolders).where(eq(projectFolders.id, id)).get();

  if (!folder) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[1520px] flex-col items-center justify-center gap-6 px-8">
        <h1 className="text-2xl font-semibold text-[var(--ink-900)]">文件夹不存在</h1>
        <Link href="/">
          <Button variant="secondary">返回首页</Button>
        </Link>
      </main>
    );
  }

  const projects = listProjects(id);

  return (
    <main id="main-content" className="relative mx-auto flex min-h-screen w-full max-w-[1520px] flex-col gap-10 px-8 py-10">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(246,126,46,0.04),transparent_70%)] blur-3xl" />
      </div>

      <section className="animate-fade-in-up relative overflow-hidden rounded-[36px] border border-[var(--line-soft)] bg-white/82 px-8 py-8 shadow-[var(--shadow-panel)] backdrop-blur-sm lg:flex lg:items-center lg:justify-between lg:px-10 lg:py-10">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-[var(--ink-500)] transition hover:text-[var(--brand-700)]">
              {"< 返回首页"}
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{"\uD83D\uDCC1"}</span>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--ink-950)]">
              {folder.name}
            </h1>
            <Badge tone="neutral" size="sm">
              {projects.length} 个项目
            </Badge>
          </div>
          <p className="text-sm text-[var(--ink-500)]">
            在此文件夹内新建和管理项目。
          </p>
        </div>

        <div className="relative z-10 mt-6 lg:mt-0 lg:shrink-0">
          <CreateProjectForm folderId={id} />
        </div>
      </section>

      <section className="animate-fade-in-up space-y-4" style={{ animationDelay: "150ms" }}>
        <ProjectList projects={projects} />
      </section>
    </main>
  );
}
