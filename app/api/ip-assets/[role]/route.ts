import fs from "node:fs/promises";

import { NextResponse } from "next/server";

import { getIpAssetPath } from "@/lib/ip-assets";

export async function GET(
  _request: Request,
  context: { params: Promise<{ role: string }> },
) {
  try {
    const { role } = await context.params;
    const assetPath = getIpAssetPath(decodeURIComponent(role));
    const buffer = await fs.readFile(assetPath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "IP 资源读取失败" },
      { status: 404 },
    );
  }
}
