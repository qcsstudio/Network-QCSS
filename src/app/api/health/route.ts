import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    ok: true,
    name: "Network QCSS",
    mode: "nextjs-product",
    time: new Date().toISOString()
  });
}
