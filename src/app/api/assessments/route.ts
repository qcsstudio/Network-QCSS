import { NextResponse } from "next/server";
import { assessmentSchema } from "@/lib/schemas";
import { requestContext } from "@/lib/security";
import { createAssessment } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = assessmentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const assessment = await createAssessment(parsed.data, await requestContext());
  return NextResponse.json({ ok: true, assessment }, { status: 201 });
}
