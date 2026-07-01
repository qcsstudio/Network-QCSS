import { NextResponse } from "next/server";
import { resourceSchema } from "@/lib/schemas";
import { requestContext } from "@/lib/security";
import { createResource } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = resourceSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const resource = await createResource(parsed.data, await requestContext());
  return NextResponse.json({ ok: true, resource }, { status: 201 });
}
