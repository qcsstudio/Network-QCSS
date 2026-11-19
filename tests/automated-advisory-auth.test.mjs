import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {validateAutomatedAdvisoryClaims,isAutomatedAdvisoryRequest} from '../src/lib/automated-advisory-auth.ts';

const now=Math.floor(Date.now()/1000);
const claims={iss:'https://token.actions.githubusercontent.com',aud:'https://www.qcsstudio.com/automation/reviewed-advisories',repository:'qcsstudio/Network-QCSS',repository_id:'1286536826',ref:'refs/heads/main',workflow_ref:'qcsstudio/Network-QCSS/.github/workflows/advisory-reviewed-publisher.yml@refs/heads/main',sub:'repo:qcsstudio/Network-QCSS:ref:refs/heads/main',event_name:'schedule',exp:now+300,nbf:now-10,iat:now-10};
test('The isolated workflow has its own exact audience and identity',()=>assert.equal(validateAutomatedAdvisoryClaims(claims,now),true));
for(const [field,value]of Object.entries({aud:'https://www.qcsstudio.com/automation',repository:'attacker/fork',repository_id:'1',ref:'refs/heads/feature',workflow_ref:'qcsstudio/Network-QCSS/.github/workflows/editorial-automation.yml@refs/heads/main',sub:'repo:attacker/fork:ref:refs/heads/main',event_name:'pull_request',exp:now-1,iat:now+60,nbf:now+60}))test(`Reject wrong ${field}`,()=>assert.equal(validateAutomatedAdvisoryClaims({...claims,[field]:value},now),false));
test('No generic cron secret or browser session authorizes this publisher',async()=>{assert.equal(await isAutomatedAdvisoryRequest(new Request('https://www.qcsstudio.com/api/cron/reviewed-advisories',{headers:{authorization:'Bearer generic-secret',cookie:'synthetic-session'}})),false);});
test('A genuine signed fixture verifies; changed signature is rejected',async()=>{
  const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048}),jwk={...publicKey.export({format:'jwk'}),kid:'fixture',alg:'RS256',use:'sig'};
  const a=Buffer.from(JSON.stringify({alg:'RS256',kid:'fixture',typ:'JWT'})).toString('base64url'),b=Buffer.from(JSON.stringify(claims)).toString('base64url');
  const token=`${a}.${b}.${sign('RSA-SHA256',Buffer.from(`${a}.${b}`),privateKey).toString('base64url')}`;
  const fetcher=async url=>{assert.equal(url,'https://token.actions.githubusercontent.com/.well-known/jwks');return Response.json({keys:[jwk]});};
  const request=token=>new Request('https://www.qcsstudio.com/api/cron/reviewed-advisories',{headers:{authorization:`Bearer ${token}`}});
  assert.equal(await isAutomatedAdvisoryRequest(request(token),fetcher),true);
  const parts=token.split('.');parts[2]=Buffer.alloc(256).toString('base64url');
  assert.equal(await isAutomatedAdvisoryRequest(request(parts.join('.')),fetcher),false);
});
