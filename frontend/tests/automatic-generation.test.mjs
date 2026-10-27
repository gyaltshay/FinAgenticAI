import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCycleWorkspace,completeDemoReports,generateFinal} from '../src/services/cycle.js';
import {completedCycle} from '../src/services/completedCycle.js';
import {cycleScopes,prepareCycleResults} from '../src/services/agentGeneration.js';
import {buildScopePackage,makeInsightFile,importInsightFile} from '../shared/scopedReports.mjs';
import {generateReport} from '../server/reporting.mjs';
import {saveManagementReport} from '../src/services/managementReports.js';

function setup(){
 let w=initialCycleWorkspace();w=generateFinal(completeDemoReports(w,w.currentPeriod),w.currentPeriod);
 const cycle=completedCycle(w,w.periods[0]),files=new Map(),calls=[];let current=true,fail=false;
 const args={cycle,isCurrent:()=>current,getWorkspace:()=>w,findInsights:(c,s)=>files.get(JSON.stringify(s)),saveInsights:f=>files.set(JSON.stringify(f.scope),f),saveReport:(payload,file)=>w=saveManagementReport(w,payload,file,{...w.users[0],userId:w.users[0].id}),
  insights:async(c,s)=>{calls.push('insights:'+s.id);if(fail)throw Error('Provider overloaded');const pkg=buildScopePackage(c,s);return makeInsightFile({report_id:c.id,reporting_period:c.period,overall_summary:'Scope results.',insights:[{id:'i1',type:'management_summary',severity:'INFO',title:'Revenue',interpretation:'Review recorded revenue.',suggested_action:'Review performance.',source_references:[pkg.references[0]],evidence:[{metric:'revenue',value:pkg.metrics.revenue}],requires_human_review:true}],limitations:[],review_status:'REVIEW_REQUIRED'},pkg);},
  report:async(c,f)=>{calls.push('report:'+f.scope.id);return {report:generateReport(importInsightFile(f,c).input),markdown:'Status: Awaiting review'};}};
 return {args,files,calls,get w(){return w;},cancel:()=>current=false,fail:value=>fail=value};
}
test('automatic preparation generates every scope in dependency order without publishing',async()=>{
 const x=setup(),scopes=cycleScopes(x.args.cycle);const result=await prepareCycleResults(x.args);
 assert.equal(result.completed,scopes.length);assert.equal(x.files.size,scopes.length);assert.equal(x.w.managementReports.length,scopes.length);
 assert.ok(x.w.managementReports.every(e=>e.status==='Pending Approval'));assert.equal(x.w.publishedResults.length,0);
 for(let n=0;n<scopes.length;n++)assert.deepEqual(x.calls.slice(n*2,n*2+2),['insights:'+scopes[n].id,'report:'+scopes[n].id]);
 const count=x.calls.length;await prepareCycleResults(x.args);assert.equal(x.calls.length,count);
});
test('failure pauses and resume reuses saved insights instead of generating them again',async()=>{
 const x=setup();let failReport=true;const report=x.args.report;x.args.report=async(...args)=>{if(failReport)throw Error('Unavailable');return report(...args);};
 await assert.rejects(prepareCycleResults(x.args),/Unavailable/);assert.equal(x.files.size,1);assert.equal(x.w.managementReports.length,0);
 failReport=false;await prepareCycleResults(x.args);assert.equal(x.calls.filter(c=>c==='insights:'+cycleScopes(x.args.cycle)[0].id).length,1);
});
test('a changed cycle discards an in-flight result',async()=>{
 const x=setup(),insights=x.args.insights;x.args.insights=async(...args)=>{const file=await insights(...args);x.cancel();return file;};
 const result=await prepareCycleResults(x.args);assert.equal(result.cancelled,true);assert.equal(x.files.size,0);assert.equal(x.w.managementReports.length,0);
});
test('automatic resume preserves approved and revision-requested reports',async()=>{
 const x=setup();await prepareCycleResults(x.args);x.w.managementReports[0].status='Approved';x.w.managementReports[1].status='Revision Required';const count=x.calls.length;
 await prepareCycleResults(x.args);assert.equal(x.calls.length,count);assert.equal(x.w.managementReports[0].status,'Approved');assert.equal(x.w.managementReports[1].status,'Revision Required');
});
