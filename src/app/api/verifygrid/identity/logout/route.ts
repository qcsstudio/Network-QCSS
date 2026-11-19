import {NextResponse} from "next/server";
import {jsonError} from "@/lib/api";
import {identityCookieOptions,revokeVerifyGridIdentity,verifyGridIdentityCookie,verifyGridLoginCookie} from "@/lib/verifygrid-identity";
import {revokeOperatorSession,verifyGridOperatorCookieName,verifyGridOperatorCookieOptions} from "@/lib/verifygrid-operator-auth";
export const runtime="nodejs";
export async function POST(request:Request) {
  try {
    const url=await revokeVerifyGridIdentity(request);
    await revokeOperatorSession(request);
    const response=NextResponse.redirect(url,303);
    response.headers.set("Cache-Control","no-store");
    for(const name of [verifyGridIdentityCookie,verifyGridLoginCookie]) response.cookies.set(name,"",{...identityCookieOptions,maxAge:0});
    response.cookies.set(verifyGridOperatorCookieName,"",{...verifyGridOperatorCookieOptions(),maxAge:0});
    return response;
  } catch {return jsonError("The sign-out request could not be accepted.",403);}
}
