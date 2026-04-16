import { unstable_noStore as noStore } from "next/cache";

import { jsonNoStore, readIdParam } from "@/lib/api-route";
import { getProjectTreeData } from "@/lib/project-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  noStore();

  const id = await readIdParam(context);
  const payload = getProjectTreeData(id);

  if (!payload) {
    return jsonNoStore({ error: "项目不存在" }, { status: 404 });
  }

  return jsonNoStore(payload);
}
