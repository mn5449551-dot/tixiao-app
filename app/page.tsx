import { CreateFolderForm } from "@/components/dashboard/create-folder-form";
import { FolderList } from "@/components/dashboard/folder-list";
import { listFolders } from "@/lib/project-data";

export default function HomePage() {
  const folders = listFolders();

  return (
    <main id="main-content" className="relative mx-auto flex min-h-screen w-full max-w-[1520px] flex-col gap-10 px-8 py-10">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(246,126,46,0.04),transparent_70%)] blur-3xl" />
        <div className="absolute -right-32 top-1/4 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(232,107,94,0.03),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(254,221,195,0.05),transparent_70%)] blur-2xl" />
      </div>

      <section className="animate-fade-in-up flex items-center justify-between rounded-[28px] border border-[var(--border)] bg-white/82 px-8 py-6 shadow-[var(--shadow-panel)]">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
          AI 图文生产工作台
        </h1>
        <CreateFolderForm existingNames={folders.map((f) => f.name)} />
      </section>

      <section className="animate-fade-in-up space-y-5" style={{ animationDelay: "150ms" }}>
        {folders.length > 0 ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[var(--ink-strong)]">我的文件夹</h2>
              <span className="text-sm text-[var(--ink-muted)]">{folders.length} 个文件夹</span>
            </div>
            <FolderList folders={folders} />
          </>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[28px] border border-[var(--border)] bg-white/90 p-10 text-center shadow-[var(--shadow-card)]">
            <span className="text-5xl">📁</span>
            <h3 className="mt-4 text-xl font-semibold text-[var(--ink-strong)]">还没有文件夹</h3>
            <p className="mt-2 max-w-sm text-sm leading-7 text-[var(--ink-default)]">
              点击右上角「新建文件夹」开始使用，每位运营同学创建自己的文件夹，方便管理项目
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
