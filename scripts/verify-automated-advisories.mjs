import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const root=process.cwd(),output=path.join(root,'test-results');fs.mkdirSync(output,{recursive:true});
const tests=fs.readdirSync(path.join(root,'tests')).filter(f=>/^automated-advisory-.*\.test\.mjs$/.test(f)).map(f=>'tests/'+f)
 .concat(['tests/automation-auth.test.mjs','tests/advisory-image-availability.test.mjs','tests/public-advisory-index.test.mjs','tests/reviewed-advisory.test.mjs','tests/reviewed-advisory-bulk.test.mjs']);
const nativeTests=['tests/ccna-social-preservation.test.mjs','tests/linkedin-native-schedule.test.mjs'];
const env={...process.env,DATABASE_URL:'',OPENAI_API_KEY:'',BFL_API_KEY:'',NEXT_TELEMETRY_DISABLED:'1',QCS_REVIEWED_ADVISORIES_ENABLED:'0',QCS_REVIEWED_FIXTURE_ROOT:'C:/Users/rksankhyan/Documents/Codex/2026-11-03/re/work/social-browser-20261116/evidence/openai-advisory-pilot-20261118/client-graphics-v4'};
// Legacy data-URL loader tests need plain Node; native CCNA extensionless imports need tsx.
const groups=[{name:'advisory',args:['--experimental-strip-types'],tests},{name:'native-preservation',args:['--import','tsx'],tests:nativeTests}].map(group=>{
 const result=spawnSync(process.execPath,[...group.args,'--import','./tests/forbid-live-network.mjs','--test','--test-reporter=tap',...group.tests],{cwd:root,env,windowsHide:true,encoding:'utf8',timeout:180000});
 const count=key=>Number(result.stdout.match(new RegExp(`^# ${key} (\\d+)$`,'m'))?.[1]||0);
 const skipped=count('skipped'),skipLines=result.stdout.split('\n').filter(line=>/^ok .*# SKIP/.test(line));
 const unsupportedFileSymlinks=process.platform==='win32'&&skipped===4&&skipLines.length===4&&skipLines.every(line=>/Real (?:matching-byte|dangling) final asset symlink is rejected on (?:new|idempotent) admission # SKIP OS file creation is unavailable \(EPERM\)/.test(line));
 return {name:group.name,exitCode:result.status,error:result.error?.message||null,tests:count('tests'),passed:count('pass'),failed:count('fail'),skipped,cancelled:count('cancelled'),todo:count('todo'),skipLines,unsupportedFileSymlinks,stdout:result.stdout,stderr:result.stderr};
});
const report={checkedAt:new Date().toISOString(),kind:'offline-code-and-preservation-tests',productionWrites:0,platformSubmissions:0,liveNetworkAllowed:false,paidGenerationAllowed:false,exitCode:groups.every(g=>g.exitCode===0&&g.failed===0&&g.cancelled===0&&g.todo===0&&(g.skipped===0||g.unsupportedFileSymlinks))?0:1,error:groups.find(g=>g.error)?.error||null,tests:groups.reduce((s,g)=>s+g.tests,0),passed:groups.reduce((s,g)=>s+g.passed,0),failed:groups.reduce((s,g)=>s+g.failed,0),skipped:groups.reduce((s,g)=>s+g.skipped,0),allRequiredTestsPassed:groups.every(g=>g.skipped===0),files:[...tests,...nativeTests].map(file=>({path:file,sha256:createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')})),groups};
const file=path.join(output,`automated-advisory-verification-${Date.now()}.json`);fs.writeFileSync(file,JSON.stringify(report,null,2),{flag:'wx'});
console.log(JSON.stringify({file,exitCode:report.exitCode,tests:report.tests,passed:report.passed,failed:report.failed,skipped:report.skipped,allRequiredTestsPassed:report.allRequiredTestsPassed,error:report.error}));
for(const group of groups)if(group.exitCode!==0)console.error(group.stdout.slice(-16000),group.stderr.slice(-4000));
assert.equal(report.exitCode,0);assert.equal(report.failed,0);assert.ok(report.tests>100);assert.equal(report.passed+report.skipped,report.tests);
