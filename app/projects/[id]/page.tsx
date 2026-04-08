import { notFound } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { getProjectWorkspace } from "@/lib/project-data";

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = getProjectWorkspace(id);

  if (!workspace) {
    notFound();
  }

  return (
    <main className="flex h-screen flex-col">
      <WorkspaceShell workspace={workspace} />
    </main>
  );
}
