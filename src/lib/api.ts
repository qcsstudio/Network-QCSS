import { NextResponse } from "next/server";

export const noStoreHeaders = {
  "Cache-Control": "no-store"
};

export function jsonError(error: unknown, status = 400) {
  return NextResponse.json({ ok: false, error }, { status, headers: noStoreHeaders });
}

export async function readJsonBody(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false as const, response: jsonError("Content-Type must be application/json.", 415) };
  }

  try {
    return { ok: true as const, data: await request.json() };
  } catch {
    return { ok: false as const, response: jsonError("Invalid JSON body.", 400) };
  }
}

export async function readFormBody(request: Request) {
  try {
    return { ok: true as const, data: await request.formData() };
  } catch {
    return { ok: false as const, response: NextResponse.redirect(new URL("/admin/login?error=1", request.url), { status: 303 }) };
  }
}
