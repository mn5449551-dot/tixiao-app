import Link from "next/link";

import { CreateProjectForm } from "@/components/dashboard/create-project-form";
import { ProjectList } from "@/components/dashboard/project-list";
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
    <main id="main-content" className="relative mx-auto flex min-h-screen w-full max-w-[1520px] flex-col gap-8 px-8 py-10">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(246,126,46,0.04),transparent_70%)] blur-3xl" />
      </div>

      <nav className="animate-fade-in-up flex items-center justify-between rounded-[20px] border border-[var(--line-soft)] bg-white/82 px-6 py-4 shadow-[var(--shadow-panel)] backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-[var(--ink-500)] transition hover:text-[var(--brand-700)]">
            ← 返回首页
          </Link>
          <span className="text-[var(--line-soft)]">|</span>
          <h1 className="text-lg font-semibold text-[var(--ink-950)]">
            📁 {folder.name}（{projects.length} 个项目）
          </h1>
        </div>
        <CreateProjectForm folderId={id} existingNames={projects.map((p) => p.title)} />
      </nav>

      <section className="animate-fade-in-up space-y-4" style={{ animationDelay: "150ms" }}>
        <ProjectList projects={projects} />
      </section>
    </main>
  );
}
