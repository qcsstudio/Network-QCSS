import {NextResponse} from "next/server";
import {jsonError,noStoreHeaders} from "@/lib/api";
import {rateLimit} from "@/lib/rate-limit";
import {beginVerifyGridIdentity,identityCookieOptions,verifyGridLoginCookie} from "@/lib/verifygrid-identity";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request) {
  const limited=rateLimit(request,{keyPrefix:"verifygrid-identity-start",max:10,windowMs:5*60_000});
  if(limited) return limited;
  try {
    const result=await beginVerifyGridIdentity(request);
    const response=NextResponse.redirect(result.url,303);
    for(const [key,value] of Object.entries(noStoreHeaders)) response.headers.set(key,value);
    response.cookies.set(verifyGridLoginCookie,result.token,{...identityCookieOptions,maxAge:300});
    return response;
  } catch {return jsonError("Operator sign-in is unavailable. Use the configured operator portal or contact the platform owner.",503);}
}
