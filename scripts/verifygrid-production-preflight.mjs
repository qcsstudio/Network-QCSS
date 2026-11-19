/** Production-only release preflight. Credentials stay on Vercel. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import pg from 'pg';
import {verifyGridSSOConfig,verifyGridSSORequired} from '../src/lib/verifygrid-identity-domain.ts';
const migration='20261103170000_verifygrid_entra_identity';
const project='prj_NDXJxUIEmhZtBwa7oAfVrA0g5UeU';
async function main(){
  assert.equal(process.env.VERCEL_ENV,'production','Refusing release migration outside production build');
  assert.equal(process.env.VERCEL_PROJECT_ID,project,'Unexpected production project');
  const identity=verifyGridSSOConfig();
  assert(!verifyGridSSORequired()||identity,'Required SSO needs complete production configuration');
  assert.equal(process.env.STORE_DRIVER,'postgres');
  const configured=process.env.DATABASE_URL;assert(configured,'Production database missing');
  assert.notEqual(crypto.createHash('sha256').update(configured).digest('hex'),'a652d007462f866c6efa8283961b66dde348d44f249c944e8f0e9b441020e559','Staging database must never be used by production');
  const connection=process.env.DATABASE_URL_UNPOOLED||configured;
  const expected=new URL(configured),url=new URL(connection);
  assert.equal(url.hostname.replace('-pooler',''),expected.hostname.replace('-pooler',''),'Direct database destination differs');
  assert.equal(url.pathname,expected.pathname);assert.equal(url.username,expected.username);
  if(['prefer','require','verify-ca'].includes(url.searchParams.get('sslmode')))url.searchParams.set('sslmode','verify-full');
  url.searchParams.delete('schema');
  const client=new pg.Client({connectionString:url.toString(),connectionTimeoutMillis:15_000});
  await client.connect();
  try{
    const applied=(await client.query('SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"')).rows;
    assert(!applied.some(r=>!r.finished_at&&!r.rolled_back_at),'Unresolved prior migration failure');
    const names=(await fs.readdir('prisma/migrations',{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>d.name).sort();
    const finished=new Set(applied.filter(r=>r.finished_at&&!r.rolled_back_at).map(r=>r.migration_name));
    assert([...finished].every(n=>names.includes(n)),'Production has an unrecognized migration');
    const pending=names.filter(n=>!finished.has(n));
    assert(pending.every(n=>n===migration),'Historical migrations need separate review: '+pending.join(','));
    assert(!(process.env.QCS_RELEASE_REQUIRE_NO_PENDING_MIGRATIONS==='1'&&pending.length),'This release is read-only: pending database migrations require a separate reviewed rollout.');
    const origin=new URL(process.env.NEXT_PUBLIC_SITE_URL||'');
    assert.equal(origin.protocol,'https:');assert(['qcsstudio.com','www.qcsstudio.com'].includes(origin.hostname));
    for(const key of ['ADMIN_EMAIL','ADMIN_PASSWORD','ADMIN_SESSION_SECRET','VERIFYGRID_PORTAL_SESSION_SECRET','VERIFYGRID_WEBAUTHN_RP_ID','VERIFYGRID_WEBAUTHN_ORIGIN','VERIFYGRID_REPORT_SIGNING_PRIVATE_KEY','VERIFYGRID_REPORT_SIGNING_PUBLIC_KEY','CRON_SECRET'])assert(process.env[key],key+' missing');
    const rp=new URL(process.env.VERIFYGRID_WEBAUTHN_ORIGIN);assert.equal(rp.protocol,'https:');
    assert(['qcsstudio.com','www.qcsstudio.com'].includes(rp.hostname));
    assert.equal(process.env.VERIFYGRID_WEBAUTHN_RP_ID,rp.hostname,'WebAuthn origin/RP mismatch');
    if(identity){
      assert.equal(identity.origin,origin.origin,'SSO must use the production canonical origin');
      assert.equal(identity.origin,rp.origin,'SSO and passkey origins must match');
      assert.notEqual(identity.sessionSecret,process.env.ADMIN_SESSION_SECRET,'Use an independent SSO encryption key');
      assert.notEqual(identity.sessionSecret,process.env.VERIFYGRID_PORTAL_SESSION_SECRET,'Use an independent SSO encryption key');
    }
    const key=crypto.createPrivateKey({key:Buffer.from(process.env.VERIFYGRID_REPORT_SIGNING_PRIVATE_KEY,'base64'),format:'der',type:'pkcs8'});
    const pub=crypto.createPublicKey({key:Buffer.from(process.env.VERIFYGRID_REPORT_SIGNING_PUBLIC_KEY,'base64'),format:'der',type:'spki'});
    assert.equal(key.asymmetricKeyType,'ed25519');assert.equal(pub.asymmetricKeyType,'ed25519');
    const proof=crypto.randomBytes(32);assert(crypto.verify(null,proof,pub,crypto.sign(null,proof,key)),'Report signing identity mismatch');
    console.log(JSON.stringify({productionPreflight:'passed',appliedMigrations:finished.size,pending,credentialsCopied:false,productionSSOEnabled:Boolean(identity),productionSSORequired:verifyGridSSORequired(),reportSigningVerified:true,webAuthnOrigin:rp.origin}));
    if(pending.length){
      const migrated=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env:{...process.env,DATABASE_URL:connection},encoding:'utf8',timeout:120_000,windowsHide:true});
      if(migrated.status!==0)throw new Error('Reviewed additive identity migration failed; promotion must remain blocked.');
    }
    const complete=await client.query('SELECT finished_at FROM "_prisma_migrations" WHERE migration_name=$1 AND rolled_back_at IS NULL',[migration]);
    assert(complete.rows.some(r=>r.finished_at),'Identity migration is incomplete');
    const tables=(await client.query("SELECT to_regclass('\"VerifyGridIdentityLogin\"') AS login, to_regclass('\"VerifyGridIdentitySession\"') AS session")).rows[0];
    assert(tables.login&&tables.session,'Identity tables unavailable');
    console.log(JSON.stringify({identityMigration:'verified',mode:'additive',existingDataRewritten:false,productionPromotion:'eligible-for-smoke-checks'}));
  }finally{await client.end();}
}
main().catch(error=>{console.error('Production release preflight failed:',error.message);process.exitCode=1;});
