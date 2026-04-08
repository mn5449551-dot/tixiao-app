import { notFound } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { getWorkspaceHeader } from "@/lib/project-data";

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const header = getWorkspaceHeader(id);

  if (!header) {
    notFound();
  }

  return (
    <main className="flex h-screen flex-col">
      <WorkspaceShell project={header.project} />
    </main>
  );
}
