import { staticMediaManifestHash, staticEditorialMediaEnabled } from "@/lib/editorial-static-media";

export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ manifestSha256: staticMediaManifestHash, cloudflareEnabled: staticEditorialMediaEnabled(),
    storageProtocol: "qcs-static-local-v2" }, {
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" }
  });
}
