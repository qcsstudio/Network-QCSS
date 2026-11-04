/** Local application-boundary fixtures. This is not a Microsoft tenant login. */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import https from "node:https";
import next from "next";
import {getPrismaClient} from "../src/lib/prisma";
const sha=(value:crypto.BinaryLike)=>crypto.createHash("sha256").update(value).digest();
const base="https://localhost:3443",ua="VerifyGrid-Isolated-Identity-QA/1.0";
type Cbor=number|string|Buffer|Map<Cbor,Cbor>;
function cbor(value:Cbor):Buffer {
  const head=(major:number,n:number)=>n<24?Buffer.from([(major<<5)|n]):n<256?Buffer.from([(major<<5)|24,n]):Buffer.from([(major<<5)|25,n>>8,n&255]);
  if(typeof value==="number")return value<0?head(1,-1-value):head(0,value);
  if(typeof value==="string"){const b=Buffer.from(value);return Buffer.concat([head(3,b.length),b]);}
  if(Buffer.isBuffer(value))return Buffer.concat([head(2,value.length),value]);
  return Buffer.concat([head(5,value.size),...[...value].flatMap(([k,v])=>[cbor(k),cbor(v)])]);
}
function registration(options:{challenge:string;rp:{id:string}}) {
  const pair=crypto.generateKeyPairSync("ec",{namedCurve:"prime256v1"}),jwk=pair.publicKey.export({format:"jwk"}),id=crypto.randomBytes(32);
  const cose=cbor(new Map<Cbor,Cbor>([[1,2],[3,-7],[-1,1],[-2,Buffer.from(jwk.x!,"base64url")],[-3,Buffer.from(jwk.y!,"base64url")]]));
  const len=Buffer.alloc(2);len.writeUInt16BE(id.length);
  const authData=Buffer.concat([sha(options.rp.id),Buffer.from([0x45]),Buffer.alloc(4),Buffer.alloc(16),len,id,cose]);
  const clientData=Buffer.from(JSON.stringify({type:"webauthn.create",challenge:options.challenge,origin:base,crossOrigin:false}));
  return {id:id.toString("base64url"),rawId:id.toString("base64url"),type:"public-key",clientExtensionResults:{},response:{transports:["internal"],clientDataJSON:clientData.toString("base64url"),attestationObject:cbor(new Map<Cbor,Cbor>([["fmt","none"],["attStmt",new Map()],["authData",authData]])).toString("base64url")}};
}
async function main() {
  assert(process.env.VERIFYGRID_QA_ISOLATED && sha(process.env.DATABASE_URL||"").toString("hex")===process.env.VERIFYGRID_QA_DATABASE_SHA256);
  assert.equal(process.env.VERIFYGRID_SSO_ORIGIN,base);assert.equal(process.env.VERIFYGRID_SSO_REQUIRED,"1");
  const prisma=getPrismaClient(),ids:string[]=[],loginIds:string[]=[],passed:string[]=[];
  // Serve the real production build at its configured HTTPS origin. A proxy to
  // `next start` on a different port changes NextRequest.url and cannot validate
  // the exact-origin callback and logout checks faithfully.
  const app=next({dev:false,hostname:"localhost",port:3443});
  const handler=app.getRequestHandler();
  const proxy=https.createServer({key:await fs.readFile(".vercel/staging-key.pem"),cert:await fs.readFile(".vercel/staging-cert.pem")},(req,res)=>{
    req.headers["x-forwarded-proto"]="https";
    void handler(req,res);
  });
  const pass=(name:string)=>{passed.push(name);console.log("PASS "+name);};
  async function request(cookie:string,route:string,body?:unknown,agent=ua,origin=base) {
    const r=await fetch(base+route,{method:body===undefined?"GET":"POST",redirect:"manual",headers:{cookie,"user-agent":agent,origin,"content-type":"application/json"},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60_000)});
    const text=await r.text();let data;try{data=JSON.parse(text);}catch{data={};}
    return {status:r.status,data,location:r.headers.get("location"),csp:r.headers.get("content-security-policy"),robots:r.headers.get("x-robots-tag"),cache:r.headers.get("cache-control"),cookies:r.headers.getSetCookie().map(c=>c.split(";")[0])};
  }
  async function fixture(role:string) {
    const operator=await prisma.verifyGridOperator.create({data:{email:`identity-${role}-${Date.now()}@verifygrid-staging.example`,displayName:`Synthetic identity ${role}`,role,identityTenantId:process.env.VERIFYGRID_ENTRA_TENANT_ID,identityObjectId:crypto.randomUUID(),createdBy:"isolated-identity-qa"}});
    ids.push(operator.id);const token=crypto.randomBytes(32).toString("base64url");
    const session=await prisma.verifyGridIdentitySession.create({data:{operatorId:operator.id,tokenHash:sha(token).toString("hex"),tenantId:operator.identityTenantId!,objectId:operator.identityObjectId!,role,userAgentHash:sha(ua).toString("hex"),expiresAt:new Date(Date.now()+15*60_000)}});
    return {operator,session,cookie:`__Host-qcs_verifygrid_identity=${token}`};
  }
  try {
    await app.prepare();
    await new Promise<void>(resolve=>proxy.listen(3443,"127.0.0.1",resolve));
    const entry=await request("","/operator/verifygrid");
    assert.equal(entry.status,200);assert(entry.csp?.includes("form-action 'self' https://login.microsoftonline.com"));
    assert(entry.robots?.includes("noindex"));assert(entry.cache?.includes("no-store"));
    assert.equal((await request("","/api/verifygrid/identity/start",{},ua,"https://wrong-origin.example")).status,503);
    pass("Operator entry is private, excluded from indexing and allows only the pinned Microsoft form redirect");
    const owner=await fixture("owner");let cookie=owner.cookie;
    assert.equal((await request(cookie,"/api/admin/verifygrid/security")).status,200);
    assert.equal((await request(cookie,"/api/admin/verifygrid/engagements")).status,401);
    pass("Opaque SSO parent fixture is recognized; passkey remains mandatory");
    const options=await request(cookie,"/api/admin/verifygrid/security",{action:"registration_options"});assert.equal(options.status,200);
    const enrolled=await request(cookie,"/api/admin/verifygrid/security",{action:"registration_verify",response:registration(options.data.options),label:"Synthetic identity QA passkey"});
    assert.equal(enrolled.status,200,JSON.stringify(enrolled.data));cookie+="; "+enrolled.cookies.join("; ");
    assert.equal((await request(cookie,"/api/admin/verifygrid/engagements")).status,200);
    assert.equal((await request(cookie,"/api/dashboard")).status,401);
    const siteAdmin=await request(cookie,"/admin");assert([302,303,307].includes(siteAdmin.status));assert(new URL(siteAdmin.location!,base).pathname==="/admin/login");
    pass("SSO + real software passkey unlock VerifyGrid and cannot enter wider administration");
    const observer=await fixture("observer");
    const mixed=observer.cookie+"; "+enrolled.cookies.join("; ");
    assert.equal((await request(mixed,"/api/admin/verifygrid/engagements")).status,401);
    assert.equal((await request(cookie,"/api/admin/verifygrid/engagements",undefined,"Different browser")).status,401);
    pass("Parent/operator identity mismatch and changed user-agent are rejected");
    const payload=Buffer.from(JSON.stringify({email:process.env.ADMIN_EMAIL,expiresAt:Date.now()+3600_000})).toString("base64url");
    const signature=crypto.createHmac("sha256",process.env.ADMIN_SESSION_SECRET!).update(payload).digest("base64url");
    assert.equal((await request(`network_qcss_admin=${payload}.${signature}`,"/api/admin/verifygrid/security")).status,401);
    pass("Required SSO mode rejects the shared administrator cookie for VerifyGrid");
    await prisma.verifyGridIdentitySession.update({where:{id:owner.session.id},data:{expiresAt:new Date(Date.now()-1)}});
    assert.equal((await request(cookie,"/api/admin/verifygrid/engagements")).status,401);
    await prisma.verifyGridIdentitySession.update({where:{id:owner.session.id},data:{expiresAt:new Date(Date.now()+15*60_000)}});
    await prisma.verifyGridOperator.update({where:{id:owner.operator.id},data:{role:"observer"}});
    assert.equal((await request(cookie,"/api/admin/verifygrid/engagements")).status,401);
    await prisma.verifyGridOperator.update({where:{id:owner.operator.id},data:{role:"owner",status:"inactive"}});
    assert.equal((await request(cookie,"/api/admin/verifygrid/engagements")).status,401);
    await prisma.verifyGridOperator.update({where:{id:owner.operator.id},data:{status:"active"}});
    pass("Parent expiry, local role changes and inactive operators invalidate access");
    const login=crypto.randomBytes(32).toString("base64url"),state=crypto.randomBytes(32).toString("base64url");
    const attempt=await prisma.verifyGridIdentityLogin.create({data:{tokenHash:sha(login).toString("hex"),stateHash:sha(state).toString("hex"),sealed:"tampered-transaction",userAgentHash:sha(ua).toString("hex"),expiresAt:new Date(Date.now()+60_000)}});
    loginIds.push(attempt.id);
    const attemptCookie=`__Host-qcs_verifygrid_identity_login=${login}`;
    const callback=`/api/verifygrid/identity/callback?state=${state}&code=synthetic`;
    assert.equal((await request(attemptCookie,callback)).status,303);
    assert((await prisma.verifyGridIdentityLogin.findUniqueOrThrow({where:{id:attempt.id}})).usedAt);
    assert.equal((await request(attemptCookie,callback)).status,303);
    pass("Tampered sign-in transaction is consumed once and replay cannot establish a session");
    assert.equal((await request(cookie,"/api/verifygrid/identity/logout",{},ua,"https://wrong-origin.example")).status,403);
    assert.equal((await request(cookie,"/api/verifygrid/identity/logout",{})).status,303);
    assert.equal((await request(cookie,"/api/admin/verifygrid/engagements")).status,401);
    pass("Logout enforces origin and revokes both application authentication boundaries");
    await fs.writeFile("artifacts/verifygrid-identity-results.json",JSON.stringify({success:true,at:new Date().toISOString(),passed,limitations:["Parent SSO records are seeded fixtures, not a Microsoft tenant sign-in","App WebAuthn uses a software authenticator; native device acceptance remains open"]},null,2));
  } finally {
    proxy.close();
    if(ids.length) await prisma.$transaction([
      prisma.verifyGridOperator.updateMany({where:{id:{in:ids}},data:{status:"inactive"}}),
      prisma.verifyGridIdentitySession.updateMany({where:{operatorId:{in:ids},revokedAt:null},data:{revokedAt:new Date()}}),
      prisma.verifyGridOperatorSession.updateMany({where:{operatorId:{in:ids},revokedAt:null},data:{revokedAt:new Date()}})
    ]);
    if(loginIds.length) await prisma.verifyGridIdentityLogin.updateMany({where:{id:{in:loginIds},usedAt:null},data:{usedAt:new Date()}});
    await prisma.$disconnect();
    await app.close();
  }
}
void main().catch(error=>{console.error(error instanceof Error?error.message:"Identity QA failed");process.exitCode=1;});
