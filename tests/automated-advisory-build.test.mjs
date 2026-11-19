import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';

const file='scripts/verifygrid-production-preflight.mjs',source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
const main=source.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='main');
assert.ok(main);
const code=ts.transpileModule(main.getText(source)+'\n;main()',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const migration='20261103170000_verifygrid_entra_identity',project='prj_NDXJxUIEmhZtBwa7oAfVrA0g5UeU';

function fixture({pending=false,readOnly=true}={}){
 const pair=crypto.generateKeyPairSync('ed25519'),messages=[],queries=[];let spawns=0,ends=0;
 // Ephemeral synthetic identities, never production credentials or connections.
 const env={VERCEL_ENV:'production',VERCEL_PROJECT_ID:project,STORE_DRIVER:'postgres',DATABASE_URL:'postgres://synthetic:synthetic@localhost/synthetic',NEXT_PUBLIC_SITE_URL:'https://www.qcsstudio.com',VERIFYGRID_WEBAUTHN_ORIGIN:'https://www.qcsstudio.com',VERIFYGRID_WEBAUTHN_RP_ID:'www.qcsstudio.com',QCS_RELEASE_REQUIRE_NO_PENDING_MIGRATIONS:readOnly?'1':'0',VERIFYGRID_REPORT_SIGNING_PRIVATE_KEY:pair.privateKey.export({format:'der',type:'pkcs8'}).toString('base64'),VERIFYGRID_REPORT_SIGNING_PUBLIC_KEY:pair.publicKey.export({format:'der',type:'spki'}).toString('base64')};
 for(const key of ['ADMIN_EMAIL','ADMIN_PASSWORD','ADMIN_SESSION_SECRET','VERIFYGRID_PORTAL_SESSION_SECRET','CRON_SECRET'])env[key]='SYNTHETIC-'+key;
 const Client=class{
  async connect(){}
  async query(sql){queries.push(sql);if(sql.includes('migration_name, finished_at'))return {rows:pending?[]:[{migration_name:migration,finished_at:new Date(),rolled_back_at:null}]};if(sql.includes('SELECT finished_at'))return {rows:[{finished_at:new Date()}]};if(sql.includes('to_regclass'))return {rows:[{login:'synthetic-login-table',session:'synthetic-session-table'}]};throw new Error('Unexpected synthetic metadata query');}
  async end(){ends++;}
 };
 return {run:()=>vm.runInNewContext(code,{assert,crypto,URL,Buffer,process:{env,execPath:'SYNTHETIC-NODE'},verifyGridSSOConfig:()=>null,verifyGridSSORequired:()=>false,pg:{Client},fs:{readdir:async()=>[{name:migration,isDirectory:()=>true}]},spawnSync:()=>{spawns++;return {status:0};},console:{log:value=>messages.push(JSON.parse(value))},migration,project}),stats:()=>({spawns,ends,queries,messages})};
}

test('Read-only deployment preflight rejects a pending migration before any child process or mutation',async()=>{
 const f=fixture({pending:true});await assert.rejects(f.run(),/read-only: pending database migrations/);
 assert.equal(f.stats().spawns,0);assert.equal(f.stats().ends,1);assert.equal(f.stats().queries.length,1);
 assert.ok(f.stats().queries.every(query=>query.startsWith('SELECT ')));
});
test('Already-applied schema passes every existing preflight check without migration dispatch',async()=>{
 const f=fixture();await f.run();const result=f.stats();assert.equal(result.spawns,0);assert.equal(result.ends,1);assert.equal(result.messages.at(-1).identityMigration,'verified');assert.ok(result.queries.every(query=>query.startsWith('SELECT ')));
});
test('The added read-only option leaves the previous default migration behavior intact',async()=>{
 const f=fixture({pending:true,readOnly:false});await f.run();assert.equal(f.stats().spawns,1);assert.equal(f.stats().ends,1);
});
