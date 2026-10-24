import test from 'node:test';
import assert from 'node:assert/strict';
import {findInsightResult,saveInsightResult} from '../src/services/insightStore.js';

test('generated insights are saved and retrieved only for their exact submission and period',()=>{
 const values=new Map();globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 try{
  const result={report_id:'submission-1',reporting_period:'August 2026',overall_summary:'Validated figures reviewed.',insights:[],limitations:[],review_status:'REVIEW_REQUIRED'};
  saveInsightResult(result);
  assert.deepEqual(findInsightResult('submission-1','August 2026'),result);
  assert.equal(findInsightResult('another-submission','August 2026'),null);
  assert.equal(findInsightResult('submission-1','July 2026'),null);
  saveInsightResult({...result,overall_summary:'Regenerated insight.'});
  assert.equal(JSON.parse(values.get('finagenticai.insight-results.v1')).length,1);
  assert.equal(findInsightResult('submission-1','August 2026').overall_summary,'Regenerated insight.');
 }finally{delete globalThis.localStorage;}
});
