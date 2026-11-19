import {createPublicKey,verify,type JsonWebKey} from 'node:crypto';

const issuer='https://token.actions.githubusercontent.com';
const audience='https://www.qcsstudio.com/automation/reviewed-advisories';
const workflow='qcsstudio/network-qcss/.github/workflows/advisory-reviewed-publisher.yml@refs/heads/main';
export function validateAutomatedAdvisoryClaims(value:Record<string,unknown>,now=Math.floor(Date.now()/1000)){
  return value.iss===issuer&&(value.aud===audience||Array.isArray(value.aud)&&value.aud.includes(audience))&&
    String(value.repository).toLowerCase()==='qcsstudio/network-qcss'&&value.repository_id==='1286536826'&&
    value.ref==='refs/heads/main'&&String(value.workflow_ref).toLowerCase()===workflow&&
    String(value.sub).toLowerCase()==='repo:qcsstudio/network-qcss:ref:refs/heads/main'&&
    ['schedule','workflow_dispatch'].includes(String(value.event_name))&&
    typeof value.exp==='number'&&value.exp>now&&value.exp<=now+15*60&&typeof value.nbf==='number'&&value.nbf<=now+30&&
    typeof value.iat==='number'&&value.iat<=now+30&&value.iat>=now-10*60;
}
export async function isAutomatedAdvisoryRequest(request:Request,fetcher:typeof fetch=fetch){
  const header=request.headers.get('authorization')||'';
  if(!header.startsWith('Bearer ')||header.length>12000)return false;
  try{
    const token=header.slice(7),parts=token.split('.');if(parts.length!==3)return false;
    const h=JSON.parse(Buffer.from(parts[0],'base64url').toString()),claims=JSON.parse(Buffer.from(parts[1],'base64url').toString());
    if(h.alg!=='RS256'||typeof h.kid!=='string'||h.typ&&h.typ!=='JWT'||!validateAutomatedAdvisoryClaims(claims))return false;
    const response=await fetcher(`${issuer}/.well-known/jwks`,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
    if(!response.ok)return false;
    const payload=await response.json() as {keys?:Array<JsonWebKey&{kid?:string;alg?:string;use?:string}>};
    const jwk=payload.keys?.find(k=>k.kid===h.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'));
    return Boolean(jwk&&verify('RSA-SHA256',Buffer.from(`${parts[0]}.${parts[1]}`),createPublicKey({key:jwk!,format:'jwk'}),Buffer.from(parts[2],'base64url'))&&validateAutomatedAdvisoryClaims(claims));
  }catch{return false;}
}
