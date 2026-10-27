import test from 'node:test';
import assert from 'node:assert/strict';
import {rawValidation,validationFindings,findingValue} from '../src/services/validationFeedback.js';
import {initialCycleWorkspace,saveValidationResult} from '../src/services/cycle.js';

const failed={rule_id:'COMP-003',field:'Revenue',status:'FAIL',severity:'ERROR',sheet:'Monthly PPR',cell:'C39',message:'Required actual value is blank.',requires_human_review:true};
const review={rule_id:'DATA-003',status:'REVIEW_REQUIRED',severity:'WARNING',message:'Scale requires review.',requires_human_review:true};
test('failed checks and source cells remain visible independently of Gemini',()=>{
 const report={schemaValidationResult:{report_id:'r1',validation_status:'FAIL',checks:[review,{rule_id:'SOURCE-EVIDENCE',status:'NOT_CHECKED'},failed,failed,{rule_id:'OK',status:'PASS',severity:'INFO'}]},geminiExplanation:{status:'unavailable'}};
 const findings=validationFindings(report);assert.equal(findings.length,2);assert.equal(findings[0].rule_id,'COMP-003');assert.equal(findings[0].location,'Monthly PPR!C39');assert.equal(findings[0].failed,true);
});
test('explanation requests use the original contract without enriched UI properties',()=>{
 const raw=rawValidation({validationResult:{report_id:'r1',validation_status:'FAIL',checks:[failed],overall_status:'VALIDATION_FAILED',summary:{rules_run:1},source_values:[]}});
 assert.deepEqual(Object.keys(raw),['report_id','validation_status','checks']);assert.equal(raw.checks[0],failed);assert.equal(rawValidation({validationStatus:'Failed'}),null);
});
test('review checks with different fields or source cells are not merged',()=>{
 const report={schemaValidationResult:{report_id:'r1',checks:[failed,{...failed,cell:'C40'}]}};assert.equal(validationFindings(report).length,2);
 assert.equal(findingValue(0),'0');assert.equal(findingValue(false),'false');assert.equal(findingValue({raw_value:''}),'Blank');
});
test('a stored-workbook recheck clears an older runtime error without creating a version',()=>{
 const w=initialCycleWorkspace(),report=w.reports[0];report.validationError='Old connection error';
 const next=saveValidationResult(w,report.id,{validation:{report_id:report.id,validation_status:'FAIL',checks:[failed]}});
 assert.equal(next.reports.length,w.reports.length);assert.equal(next.reports[0].id,report.id);assert.equal(next.reports[0].revision,report.revision);assert.equal(next.reports[0].validationError,null);assert.equal(next.reports[0].validationStatus,'Failed');
});
