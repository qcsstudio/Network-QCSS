import crypto from "node:crypto";
import {cookies,headers} from "next/headers";
import * as oidc from "openid-client";
import {getAdminSession} from "@/lib/admin-auth";
import {getPrismaClient} from "@/lib/prisma";
import {
  openVerifyGridLogin,sealVerifyGridLogin,verifyGridEntraIdentity,verifyGridOperatorPath,
  verifyGridSSOConfig,verifyGridSSOMaxAgeSeconds,verifyGridSSORequired,type VerifyGridSSOConfig
} from "@/lib/verifygrid-identity-domain";

const secure = process.env.NODE_ENV === "production";
export const verifyGridIdentityCookie = secure ? "__Host-qcs_verifygrid_identity" : "qcs_verifygrid_identity";
export const verifyGridLoginCookie = secure ? "__Host-qcs_verifygrid_identity_login" : "qcs_verifygrid_identity_login";
export const identityCookieOptions = {httpOnly:true,secure,sameSite:"lax" as const,path:"/"};
const sha256 = (value:string) => crypto.createHash("sha256").update(value).digest("hex");
const fingerprint = (list:Headers) => sha256(list.get("user-agent") || "unknown");
function requestCookie(request:Request,name:string) {
  return (request.headers.get("cookie") || "").split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="))?.slice(name.length+1) || "";
}
export function assertIdentityOrigin(request:Request,config:VerifyGridSSOConfig,post=false) {
  if(new URL(request.url).origin !== config.origin || (post && request.headers.get("origin") !== config.origin)) {
    throw new Error("Identity requests must use the configured application origin.");
  }
}
let discoveryCache: {key:string;value:Promise<oidc.Configuration>} | undefined;
async function client(config:VerifyGridSSOConfig) {
  const key=sha256(config.issuer+config.clientId+config.clientSecret);
  if(!discoveryCache || discoveryCache.key !== key) {
    const value=oidc.discovery(new URL(config.issuer),config.clientId,config.clientSecret).then(result=>{
      const metadata=result.serverMetadata();
      if(metadata.issuer !== config.issuer) throw new Error("The identity discovery issuer does not match.");
      for(const endpoint of [metadata.authorization_endpoint,metadata.token_endpoint,metadata.jwks_uri]) {
        const url=new URL(endpoint || "");
        if(url.protocol !== "https:" || url.hostname !== "login.microsoftonline.com") throw new Error("Unexpected identity endpoint.");
      }
      oidc.enableNonRepudiationChecks(result);
      return result;
    }).catch(error=>{discoveryCache=undefined;throw error;});
    discoveryCache={key,value};
  }
  return discoveryCache.value;
}

export async function beginVerifyGridIdentity(request:Request) {
  const config=verifyGridSSOConfig();
  if(!config) throw new Error("VerifyGrid single sign-on is not configured.");
  assertIdentityOrigin(request,config,true);
  const configuration=await client(config);
  const verifier=oidc.randomPKCECodeVerifier(),state=oidc.randomState(),nonce=oidc.randomNonce();
  const token=crypto.randomBytes(32).toString("base64url");
  const prisma=getPrismaClient();
  await prisma.verifyGridIdentityLogin.deleteMany({where:{expiresAt:{lt:new Date(Date.now()-86_400_000)}}});
  await prisma.verifyGridIdentityLogin.create({data:{tokenHash:sha256(token),stateHash:sha256(state),
    sealed:sealVerifyGridLogin({verifier,state,nonce},config.sessionSecret),userAgentHash:fingerprint(request.headers),expiresAt:new Date(Date.now()+5*60_000)}});
  const url=oidc.buildAuthorizationUrl(configuration,{redirect_uri:config.redirectUri,scope:"openid profile email",response_type:"code",
    code_challenge:await oidc.calculatePKCECodeChallenge(verifier),code_challenge_method:"S256",state,nonce,prompt:"select_account"});
  return {url,token};
}

export async function completeVerifyGridIdentity(request:Request) {
  const config=verifyGridSSOConfig();
  if(!config) throw new Error("VerifyGrid single sign-on is not configured.");
  assertIdentityOrigin(request,config);
  const cookie=requestCookie(request,verifyGridLoginCookie);
  if(!cookie) throw new Error("The sign-in transaction is missing.");
  const prisma=getPrismaClient(),now=new Date();
  const attempt=await prisma.verifyGridIdentityLogin.findUnique({where:{tokenHash:sha256(cookie)}});
  const url=new URL(request.url);
  if(!attempt || attempt.usedAt || attempt.expiresAt <= now || attempt.userAgentHash !== fingerprint(request.headers) ||
      attempt.stateHash !== sha256(url.searchParams.get("state") || "")) throw new Error("The sign-in transaction is invalid or expired.");
  const consumed=await prisma.verifyGridIdentityLogin.updateMany({where:{id:attempt.id,usedAt:null,expiresAt:{gt:now}},data:{usedAt:now}});
  if(consumed.count !== 1) throw new Error("The sign-in transaction was already consumed.");
  const saved=openVerifyGridLogin(attempt.sealed,config.sessionSecret);
  const tokens=await oidc.authorizationCodeGrant(await client(config),url,
    {pkceCodeVerifier:saved.verifier,expectedState:saved.state,expectedNonce:saved.nonce,idTokenExpected:true});
  const claims=tokens.claims();
  if(!claims) throw new Error("A verified identity token is required.");
  const identity=verifyGridEntraIdentity(claims,config);
  const token=crypto.randomBytes(32).toString("base64url");
  const expiresAt=new Date(Math.min(Date.now()+verifyGridSSOMaxAgeSeconds*1000,identity.tokenExpiresAt.getTime()));
  await prisma.$transaction(async tx=>{
    let operator=await tx.verifyGridOperator.findUnique({where:{identityTenantId_identityObjectId:{identityTenantId:identity.tenantId,identityObjectId:identity.objectId}}});
    if(operator && operator.status !== "active") throw new Error("This operator is inactive.");
    // Never attach an external identity to an existing account by email alone.
    const collision=await tx.verifyGridOperator.findUnique({where:{email:identity.email}});
    if(collision && collision.id !== operator?.id) throw new Error("An explicit identity migration is required for this account.");
    const changed=operator && (operator.role !== identity.role || operator.email !== identity.email);
    if(changed) {
      await tx.verifyGridOperatorSession.updateMany({where:{operatorId:operator!.id,revokedAt:null},data:{revokedAt:new Date()}});
      await tx.verifyGridIdentitySession.updateMany({where:{operatorId:operator!.id,revokedAt:null},data:{revokedAt:new Date()}});
    }
    operator=operator ? await tx.verifyGridOperator.update({where:{id:operator.id},data:{email:identity.email,role:identity.role,displayName:identity.displayName}})
      : await tx.verifyGridOperator.create({data:{email:identity.email,displayName:identity.displayName,role:identity.role,
        identityTenantId:identity.tenantId,identityObjectId:identity.objectId,createdBy:"entra-assigned-app-role"}});
    await tx.verifyGridIdentitySession.create({data:{operatorId:operator.id,tokenHash:sha256(token),tenantId:identity.tenantId,
      objectId:identity.objectId,role:identity.role,userAgentHash:fingerprint(request.headers),expiresAt}});
    await tx.auditLog.create({data:{action:"verifygrid.identity_signed_in",actor:identity.email,target:operator.id,
      metadata:{provider:"entra",tenantId:identity.tenantId,objectId:identity.objectId,role:identity.role,roleChanged:Boolean(changed)}}});
  },{isolationLevel:"Serializable",timeout:15_000});
  return {token,expiresAt,redirect:config.origin+verifyGridOperatorPath};
}

export type VerifyGridParentIdentity = {email:string;provider:"legacy"|"entra";operatorId?:string};
export async function getVerifyGridParentIdentity():Promise<VerifyGridParentIdentity|null> {
  let config:ReturnType<typeof verifyGridSSOConfig>;
  try {config=verifyGridSSOConfig();} catch {return null;}
  if(config) {
    const store=await cookies(),list=await headers();
    const token=store.get(verifyGridIdentityCookie)?.value;
    if(token) {
      const session=await getPrismaClient().verifyGridIdentitySession.findUnique({where:{tokenHash:sha256(token)},include:{operator:true}});
      if(session && !session.revokedAt && session.expiresAt > new Date() && session.userAgentHash === fingerprint(list) &&
          session.tenantId === config.tenantId && session.operator.status === "active" && session.operator.role === session.role &&
          session.operator.identityTenantId === session.tenantId && session.operator.identityObjectId === session.objectId) {
        return {email:session.operator.email,operatorId:session.operatorId,provider:"entra"};
      }
    }
  }
  if(verifyGridSSORequired()) return null;
  const admin=await getAdminSession();
  return admin ? {email:admin.email,provider:"legacy"} : null;
}

export async function revokeVerifyGridIdentity(request:Request) {
  const config=verifyGridSSOConfig();
  if(!config) throw new Error("VerifyGrid single sign-on is not configured.");
  assertIdentityOrigin(request,config,true);
  const token=requestCookie(request,verifyGridIdentityCookie);
  if(token) await getPrismaClient().verifyGridIdentitySession.updateMany({where:{tokenHash:sha256(token),revokedAt:null},data:{revokedAt:new Date()}});
  const login=requestCookie(request,verifyGridLoginCookie);
  if(login) await getPrismaClient().verifyGridIdentityLogin.updateMany({where:{tokenHash:sha256(login),usedAt:null},data:{usedAt:new Date()}});
  await getPrismaClient().auditLog.create({data:{action:"verifygrid.identity_signed_out",target:"operator-console"}});
  return config.origin+verifyGridOperatorPath;
}
