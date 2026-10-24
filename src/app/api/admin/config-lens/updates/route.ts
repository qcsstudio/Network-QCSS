import { isAdminRequest } from "@/lib/admin-auth";
import { collectVendorUpdates, type VendorUpdateReport } from "@/lib/config-lens/vendor-updates";

export const runtime = "nodejs";
export const maxDuration = 30;
let previous: VendorUpdateReport | null = null;
let pending: Promise<VendorUpdateReport> | null = null;
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
export async function POST(request: Request) {
  if (!isAdminRequest(request)) return Response.json({ error: "Administrator sign-in required." }, { status: 401, headers });
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  let sameOrigin = false;
  try {
    const source = new URL(origin || "");
    // Next's internal URL may use localhost; the browser cannot forge the Host header.
    sameOrigin = source.protocol === requestUrl.protocol && source.host === request.headers.get("host") && source.origin === origin;
  } catch { /* Missing or invalid Origin stays denied. */ }
  if (!sameOrigin) return Response.json({ error: "Same-origin request required." }, { status: 403, headers });
  if (request.body !== null) {
    // Some browsers send an empty stream for a bodyless POST. Never buffer input.
    const reader = request.body.getReader();
    try {
      let empty = false;
      for (let i = 0; i < 4; i++) {
        const chunk = await reader.read();
        if (chunk.done) { empty = true; break; }
        if (chunk.value.byteLength) break;
      }
      if (!empty) return Response.json({ error: "This endpoint accepts no configuration, URL or request body." }, { status: 400, headers });
    } finally { await reader.cancel(); }
  }
  if (previous && Date.now() - Date.parse(previous.checkedAt) < 30 * 60 * 1000) return Response.json({ report: previous, cached: true }, { headers });
  pending ||= collectVendorUpdates();
  try { previous = await pending; return Response.json({ report: previous, cached: false }, { headers }); }
  finally { pending = null; }
}
