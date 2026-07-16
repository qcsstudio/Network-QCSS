import { NextResponse } from "next/server";
import { scoreAssessment } from "@/lib/assessment-engine";
import { jsonError, readJsonBody } from "@/lib/api";
import { tools } from "@/lib/content";
import { rateLimit } from "@/lib/rate-limit";
import { assessmentSchema } from "@/lib/schemas";
import { requestContext } from "@/lib/security";
import { createAssessment } from "@/lib/store";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function POST(request: Request) {
  const limited = rateLimit(request, { keyPrefix: "assessments", max: 30, windowMs: 60_000 });
  if (limited) return limited;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = assessmentSchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError(parsed.error.flatten(), 400);
  }

  const tool = tools.find((item) => item.slug === parsed.data.tool);
  if (!tool) {
    return jsonError("Unknown assessment tool.", 400);
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
