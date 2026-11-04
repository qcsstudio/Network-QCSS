import {NextResponse} from "next/server";
import {completeVerifyGridIdentity,identityCookieOptions,verifyGridIdentityCookie,verifyGridLoginCookie} from "@/lib/verifygrid-identity";
import {verifyGridOperatorPath,verifyGridSSOConfig} from "@/lib/verifygrid-identity-domain";
import {getPrismaClient} from "@/lib/prisma";
import {rateLimit} from "@/lib/rate-limit";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const limited=rateLimit(request,{keyPrefix:"verifygrid-identity-callback",max:20,windowMs:5*60_000});
  if(limited) return limited;
  try {
    const result=await completeVerifyGridIdentity(request);
    const response=NextResponse.redirect(result.redirect,303);
    response.headers.set("Cache-Control","no-store");
    response.headers.set("Referrer-Policy","no-referrer");
    response.cookies.set(verifyGridIdentityCookie,result.token,{...identityCookieOptions,maxAge:Math.max(0,Math.floor((result.expiresAt.getTime()-Date.now())/1000))});
    response.cookies.set(verifyGridLoginCookie,"",{...identityCookieOptions,maxAge:0});
    return response;
  } catch {
    // Never echo OAuth codes, state, identity claims or SDK errors to the client/log.
    let origin=new URL(request.url).origin;
    let configured=false;
    try {const config=verifyGridSSOConfig();origin=config?.origin || origin;configured=Boolean(config);} catch {}
    if(configured) {
      try {await getPrismaClient().auditLog.create({data:{action:"verifygrid.identity_sign_in_rejected",target:"operator-console"}});} catch {}
    }
    const response=NextResponse.redirect(origin+verifyGridOperatorPath+"?error=identity",303);
    response.headers.set("Cache-Control","no-store");
    response.headers.set("Referrer-Policy","no-referrer");
    response.cookies.set(verifyGridLoginCookie,"",{...identityCookieOptions,maxAge:0});
    return response;
  }
}
