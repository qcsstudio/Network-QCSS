import { NextResponse } from "next/server";
import { scoreAssessment } from "@/lib/assessment-engine";
import { tools } from "@/lib/content";
import { assessmentSchema } from "@/lib/schemas";
import { requestContext } from "@/lib/security";
import { createAssessment } from "@/lib/store";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function POST(request: Request) {
  const parsed = assessmentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const tool = tools.find((item) => item.slug === parsed.data.tool);
  if (!tool) {
    return NextResponse.json({ ok: false, error: "Unknown assessment tool." }, { status: 400 });
  }

  const submittedAnswers = parsed.data.answers;
  const rawAnswers = isRecord(submittedAnswers.raw) ? submittedAnswers.raw : submittedAnswers;
  const profile = scoreAssessment(tool, rawAnswers);

  const assessment = await createAssessment(
    {
      ...parsed.data,
      tool: tool.slug,
      title: tool.title,
      pipeline: profile.pipeline,
      recommendation: profile.recommendation,
      riskLevel: profile.riskLevel,
      score: profile.score,
      answers: {
        ...submittedAnswers,
        raw: rawAnswers,
        profile,
        trustedServerScore: true
      }
    },
    await requestContext()
  );

  return NextResponse.json(
    {
      ok: true,
      assessment: {
        id: assessment.id,
        tool: assessment.tool,
        pipeline: assessment.pipeline,
        score: assessment.score,
        riskLevel: assessment.riskLevel,
        recommendation: assessment.recommendation,
        profile,
        createdAt: assessment.createdAt
      }
    },
    { status: 201 }
  );
}
