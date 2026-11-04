import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCustodyEventHash,verifyCustodyEventHash,buildReportChainHash,verifyReportChainHash} from '../src/lib/verifygrid-assurance-domain.ts';
import {sha256Json} from '../src/lib/verifygrid-execution-domain.ts';

const event={engagementId:'synthetic',sequence:1,eventType:'report_created',subjectType:'report',subjectId:'report-1',action:'draft',actor:'analyst@example.test',occurredAt:'2026-11-03T12:00:00.000Z',classification:'confidential',details:{version:1}};
test('custody hashes survive nullable database field round trips',()=>{
  const persisted={...event,sourceSha256:null,previousHash:null};
  assert.equal(buildCustodyEventHash(event),buildCustodyEventHash(persisted));
  assert(verifyCustodyEventHash(persisted,buildCustodyEventHash(event)));
});
test('report chain origin survives database round trips and verifies legacy roots',()=>{
  const report={engagementId:'synthetic',reportType:'technical',version:1,snapshotSha256:'a'.repeat(64),generatedAt:event.occurredAt};
  assert.equal(buildReportChainHash(report),buildReportChainHash({...report,previousChainHash:null}));
  const old=sha256Json({schema:'qcs.verifygrid.report-chain.v1',...report});
  assert(verifyReportChainHash({...report,previousChainHash:null},old));
  assert(!verifyReportChainHash({...report,version:2},old));
});
test('legacy omission hashes remain verifiable without accepting altered events',()=>{
  const oldHash=sha256Json({schema:'qcs.verifygrid.custody-event.v1',...event});
  assert(verifyCustodyEventHash({...event,sourceSha256:null,previousHash:null},oldHash));
  assert(!verifyCustodyEventHash({...event,action:'altered'},oldHash));
  assert(!verifyCustodyEventHash({...event,previousHash:'a'.repeat(64)},oldHash));
});
