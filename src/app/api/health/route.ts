import { NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/api";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      name: "QuantumCrafters Studio Pvt. Ltd.",
      mode: "nextjs-product",
      time: new Date().toISOString()
    },
    { headers: noStoreHeaders }
  );
}
