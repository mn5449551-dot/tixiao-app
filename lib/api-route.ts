import { NextResponse } from "next/server";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

export async function readIdParam(context: { params: Promise<unknown> }): Promise<string> {
  const { id } = (await context.params) as { id: string };
  return id;
}

export function getRouteErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error ? error.message : fallbackMessage;
}

export function jsonError(message: string, status = 500): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function jsonNoStore(body: unknown, init?: { status?: number }): NextResponse {
  return NextResponse.json(body, {
    status: init?.status,
    headers: NO_STORE_HEADERS,
  });
}
