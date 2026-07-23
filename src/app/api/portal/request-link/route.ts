import { NextResponse } from "next/server";
import { noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { verifyGridPortalLinkRequestSchema } from "@/lib/verifygrid-onboarding-domain";
import { issueVerifyGridPortalLinksByEmail } from "@/lib/verifygrid-portal-auth";
import { sendVerifyGridPortalLinksEmail } from "@/lib/verifygrid-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const limited = rateLimit(request, { keyPrefix: "verifygrid-portal-link", max: 5, windowMs: 10 * 60_000 });
  if (limited) return limited;
  const body = await readJsonBody(request);
  const parsed = body.ok ? verifyGridPortalLinkRequestSchema.safeParse(body.data) : null;

  if (parsed?.success) {
    try {
      const links = await issueVerifyGridPortalLinksByEmail(parsed.data.email);
      if (links.length) {
        await sendVerifyGridPortalLinksEmail({
          email: parsed.data.email,
          links: links.map((link) => ({ organizationName: link.organizationName, accessUrl: link.accessUrl, tokenId: link.tokenId }))
        });
      }
    } catch (error) {
      console.error("Unable to process VerifyGrid sign-in link request.", error);
    }
  }

  await delay(Math.max(0, 350 - (Date.now() - startedAt)));
  return NextResponse.json(
    { ok: true, message: "If an eligible workspace membership exists, a one-time sign-in link will be sent." },
    { status: 202, headers: noStoreHeaders }
  );
}

