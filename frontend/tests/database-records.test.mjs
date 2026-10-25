import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCycleWorkspace} from '../src/services/cycle.js';
import {projectDatabaseRecords,validateDatabaseRecords,mergeDatabaseRecords} from '../shared/database-records.mjs';

test('database projection keeps profiles and upload references but excludes all agent results',()=>{
 const w=initialCycleWorkspace();w.users[0].password='never-store-this';w.users[0].passwordHash='not-part-of-profiles';
 w.reports[0].data={revenue:12345};w.reports[0].validationResult={secretFindings:true};w.reports[0].schemaValidationResult={checks:['finding']};w.reports[0].geminiExplanation={text:'agent-result'};
 w.reports[0].originalWorkbook={id:'object',submissionId:w.reports[0].id,company:w.reports[0].company,period:w.reports[0].period,version:w.reports[0].revision,key:'originals/key',bucket:'financial-submissions',accessToken:'signed-test-receipt',data:{secret:true}};
 const projected=validateDatabaseRecords(projectDatabaseRecords(w));
 assert.equal(projected.submissions[0].originalWorkbook.key,'originals/key');
 const text=JSON.stringify(projected);for(const excluded of ['never-store-this','passwordHash','revenue','secretFindings','agent-result','checks','secret'])assert.ok(!text.includes(excluded));
 assert.equal(projected.users.length,24);assert.equal(projected.companies.length,25);
});
test('database metadata restore preserves matching local results without fabricating missing results',()=>{
 const w=initialCycleWorkspace(),records=projectDatabaseRecords(w);records.users[0].name='Updated admin';records.companies[0].name='Updated company';
 const next=mergeDatabaseRecords(w,records);assert.equal(next.users[0].name,'Updated admin');assert.deepEqual(next.reports[0].data,w.reports[0].data);
 const fresh=mergeDatabaseRecords({...w,reports:[]},records);assert.deepEqual(fresh.reports[0].data,{});assert.equal(fresh.reports[0].validationResult,null);
});
test('invalid relationships, last-admin removal, duplicate email and submission versions are rejected',()=>{
 const original=projectDatabaseRecords(initialCycleWorkspace());
 for(const mutate of [r=>r.users[0].active=false,r=>r.users[1].company='UNKNOWN',r=>r.users[1].email=r.users[0].email,r=>r.submissions.push({...r.submissions[0],id:'duplicate'}),r=>r.periods[0].requiredCompanyIds.push('UNKNOWN')]){
  const records=structuredClone(original);mutate(records);assert.throws(()=>validateDatabaseRecords(records));
 }
});
test('a MinIO reference cannot be attached to a different submission version',()=>{
 const records=projectDatabaseRecords(initialCycleWorkspace());records.submissions[0].originalWorkbook={submissionId:'wrong',company:records.submissions[0].company,period:records.submissions[0].period,version:records.submissions[0].revision};assert.throws(()=>validateDatabaseRecords(records),/match/);
});
