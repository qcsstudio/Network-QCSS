import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import * as oidc from 'openid-client';
import {verifyGridSSOConfig,verifyGridEntraIdentity,sealVerifyGridLogin,openVerifyGridLogin} from '../src/lib/verifygrid-identity-domain.ts';
const tenant='6126ea2d-829b-4a0b-8d2f-329ec33be999',client='fb4491b3-965d-4788-94cc-9637d6a8ba61',object='5245ff81-b1aa-46a2-92be-536e93bfa033';
const env={VERIFYGRID_SSO_ENABLED:'1',VERIFYGRID_ENTRA_TENANT_ID:tenant,VERIFYGRID_ENTRA_CLIENT_ID:client,VERIFYGRID_ENTRA_CLIENT_SECRET:'synthetic-only',VERIFYGRID_SSO_SESSION_SECRET:'s'.repeat(48),VERIFYGRID_SSO_ORIGIN:'https://staging.example.test',NODE_ENV:'production'};
const config=verifyGridSSOConfig(env);
const now=Date.now();
const claims={iss:config.issuer,aud:client,tid:tenant,oid:object,ver:'2.0',sub:'pairwise-subject',preferred_username:'analyst@tenant.onmicrosoft.com',roles:['VerifyGrid.Analyst'],iat:Math.floor(now/1000),exp:Math.floor(now/1000)+600};
test('SSO is disabled by default and rejects generic tenants, invalid credentials and origins',()=>{
  assert.equal(verifyGridSSOConfig({}),null);
  for(const patch of [{VERIFYGRID_ENTRA_TENANT_ID:'common'},{VERIFYGRID_ENTRA_CLIENT_ID:''},{VERIFYGRID_SSO_SESSION_SECRET:'short'},{VERIFYGRID_SSO_ORIGIN:'http://example.test'},{VERIFYGRID_SSO_ORIGIN:'https://staging.example.test/other'}]) assert.throws(()=>verifyGridSSOConfig({...env,...patch}));
  assert.equal(config.redirectUri,'https://staging.example.test/api/verifygrid/identity/callback');
});
test('immutable tenant/object identity carries exactly one assigned application role',()=>{
  const a=verifyGridEntraIdentity(claims,config,now);
  const b=verifyGridEntraIdentity({...claims,preferred_username:'renamed@tenant.onmicrosoft.com'},config,now);
  assert.equal(a.objectId,b.objectId);assert.equal(a.tenantId,b.tenantId);assert.equal(a.role,'analyst');assert.notEqual(a.email,b.email);
  for(const patch of [{roles:[]},{roles:['VerifyGrid.Owner','VerifyGrid.Reviewer']},{roles:['Other.Admin']},{oid:undefined},{tid:client},{iss:'https://other.example'},{aud:object},{exp:Math.floor(now/1000)},{iat:Math.floor(now/1000)+120},{ver:'1.0'}]) assert.throws(()=>verifyGridEntraIdentity({...claims,...patch},config,now));
});
test('sign-in transaction secrets are authenticated ciphertext and reject alteration',()=>{
  const data={verifier:'v'.repeat(43),nonce:'n'.repeat(32),state:'s'.repeat(32)};
  const sealed=sealVerifyGridLogin(data,env.VERIFYGRID_SSO_SESSION_SECRET);
  assert.deepEqual(openVerifyGridLogin(sealed,env.VERIFYGRID_SSO_SESSION_SECRET),data);
  assert.throws(()=>openVerifyGridLogin(sealed,'another-secret'));
  const altered=Buffer.from(sealed,'base64url');altered[30]^=1;
  assert.throws(()=>openVerifyGridLogin(altered.toString('base64url'),env.VERIFYGRID_SSO_SESSION_SECRET));
});

const pair=generateKeyPairSync('rsa',{modulusLength:2048});
async function grant({badState=false,badNonce=false,badSignature=false}={}) {
  const nonce='synthetic-nonce',state='synthetic-state',verifier='v'.repeat(43);
  const metadata={issuer:config.issuer,authorization_endpoint:config.issuer+'/authorize',token_endpoint:config.issuer+'/token',jwks_uri:config.issuer+'/keys',response_types_supported:['code'],subject_types_supported:['public'],id_token_signing_alg_values_supported:['RS256']};
  const sdk=new oidc.Configuration(metadata,client,'synthetic-only');
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const body=encode({alg:'RS256',kid:'test-key'})+'.'+encode({...claims,nonce:badNonce?'wrong':nonce});
  const privateKey=badSignature?generateKeyPairSync('rsa',{modulusLength:2048}).privateKey:pair.privateKey;
  const jwt=body+'.'+sign('RSA-SHA256',Buffer.from(body),privateKey).toString('base64url');
  sdk[oidc.customFetch]=async(input,options)=>{
    const url=new URL(String(input));
    if(url.pathname.endsWith('/keys'))return Response.json({keys:[{...pair.publicKey.export({format:'jwk'}),kid:'test-key',alg:'RS256',use:'sig'}]});
    assert(url.pathname.endsWith('/token'));
    assert.equal(new URLSearchParams(options.body).get('code_verifier'),verifier);
    return Response.json({access_token:'synthetic',token_type:'Bearer',expires_in:600,id_token:jwt});
  };
  oidc.enableNonRepudiationChecks(sdk);
  return oidc.authorizationCodeGrant(sdk,new URL('https://staging.example.test/api/verifygrid/identity/callback?code=synthetic-code&state='+state),{expectedState:badState?'wrong':state,expectedNonce:nonce,pkceCodeVerifier:verifier,idTokenExpected:true});
}
test('OIDC code flow verifies nonce, state, PKCE and RSA signature using isolated protocol fixtures',async()=>{
  const tokens=await grant();assert.equal(verifyGridEntraIdentity(tokens.claims(),config).role,'analyst');
  await assert.rejects(()=>grant({badState:true}));await assert.rejects(()=>grant({badNonce:true}));await assert.rejects(()=>grant({badSignature:true}));
});
