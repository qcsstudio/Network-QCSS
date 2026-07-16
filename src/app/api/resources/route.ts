import { NextResponse } from "next/server";
import { jsonError, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { resourceSchema } from "@/lib/schemas";
import { requestContext } from "@/lib/security";
import { createResource } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = rateLimit(request, { keyPrefix: "resources", max: 60, windowMs: 60_000 });
  if (limited) return limited;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = resourceSchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError(parsed.error.flatten(), 400);
  }

  const resource = await createResource(parsed.data, await requestContext());
  return NextResponse.json(
    {
      ok: true,
      resource: {
        id: resource.id,
        resource: resource.resource,
        createdAt: resource.createdAt
      }
    },
    { status: 201 }
  );
}
