import { NextResponse } from "next/server";

import { createLogoPreviewBuffer } from "@/lib/logo-assets";

export async function GET(
  _request: Request,
  context: { params: Promise<{ logo: string }> },
) {
  try {
    const { logo } = await context.params;
    const buffer = await createLogoPreviewBuffer(
      decodeURIComponent(logo) as "onion" | "onion_app",
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Logo 资源读取失败" },
      { status: 404 },
    );
  }
}
