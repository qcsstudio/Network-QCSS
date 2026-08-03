import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^\d{4,10}$/.test(code)) return new NextResponse("Advisory not found.", { status: 404 });

  const advisories = await getPrismaClient().securityAdvisory.findMany({
    where: { status: { in: ["published", "withdrawn"] } },
    orderBy: [{ vendorPublishedAt: "desc" }, { priorityScore: "desc" }],
    take: 250,
    select: { cves: true, slug: true }
  });
  const advisory = advisories.find((item) =>
    Array.isArray(item.cves) && item.cves.some((cve) => typeof cve === "string" && cve.toUpperCase().endsWith(`-${code}`))
  );
  if (!advisory) return new NextResponse("Advisory not found.", { status: 404 });

  return NextResponse.redirect(new URL(`/security-advisories/${advisory.slug}`, request.url), 307);
}
