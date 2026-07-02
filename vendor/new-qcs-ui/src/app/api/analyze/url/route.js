import { scoreLinkedInProfilePayload } from "@/scoring/linkedinProfileScoring";

export async function POST(request) {
  try {
    const body = await request.json();
    const selectedRole = body?.role || body?.selectedRole || body?.persona;
    const report = scoreLinkedInProfilePayload(body, selectedRole);

    return Response.json({
      success: true,
      profile: body,
      report,
      score: report.overallScore,
      suggestions: report.suggestions,
      makeover: report.makeover,
    });
  } catch (error) {
    return Response.json(
      { success: false, message: error.message || "Unable to analyze profile" },
      { status: 500 }
    );
  }
}
