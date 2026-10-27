import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:5187/';
const dev=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5187','--strictPort'],{cwd:new URL('../',import.meta.url),windowsHide:true,stdio:'ignore'});
let browser;
try{
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}if(i===59)throw Error('Vite did not start');await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let attempt=0,release,payload,rechecks=0,uploads=0,validation;
 await page.route('**/api/**',async route=>{
  const url=route.request().url();
  if(url.endsWith('/explain-validation')){
   payload=route.request().postDataJSON();attempt++;
   if(attempt===1){await new Promise(r=>release=r);return route.fulfill({status:503,json:{error:'Synthetic provider unavailable'}});}
   return route.fulfill({json:{status:'complete',summary:'An actual value is missing.',explanations:[{rule_id:'COMP-003',explanation:'Enter the verified actual value at Monthly PPR!C39.'}]}});
  }
  if(url.endsWith('/validate')){rechecks++;return route.fulfill({json:validation});}
  if(url.endsWith('/storage/workbooks'))uploads++;
  return route.fulfill({json:{configured:false}});
 });
 await page.goto(base);
 const seeded=await page.evaluate(async()=>{
  const {initialCycleWorkspace,saveValidationResult}=await import('/src/services/cycle.js');
  let w=initialCycleWorkspace(),r=w.reports.find(r=>r.company==='TTPL');
  const validation={report_id:r.id,reporting_period:r.period,validation_status:'FAIL',checks:[{rule_id:'COMP-003',field:'Revenue',status:'FAIL',severity:'ERROR',sheet:'Monthly PPR',cell:'C39',message:'Required actual value is blank.',requires_human_review:true,actual_value:''}]};
  w=saveValidationResult(w,r.id,{validation,gemini:{status:'not_requested'}});
  localStorage.setItem('finagenticai.workspace.v3',JSON.stringify(w));sessionStorage.setItem('finagenticai.session.v3',JSON.stringify({userId:w.users.find(u=>u.role==='admin').id}));
  return {id:r.id,revision:r.revision,count:w.reports.length,validation};
 });validation=seeded.validation;
 await page.goto(base+'#validation/'+seeded.id);await page.reload();
 await page.getByRole('heading',{name:'Validation findings',exact:true}).waitFor();
 await page.getByRole('cell',{name:'Monthly PPR!C39',exact:true}).waitFor();
 await page.getByRole('heading',{name:'Gemini explanation not requested',exact:true}).waitFor();
 await page.getByRole('button',{name:'Explain findings with Gemini',exact:true}).click();
 await page.getByRole('heading',{name:'Preparing Gemini explanation…',exact:true}).waitFor();
 assert.equal(await page.getByText('Required actual value is blank.',{exact:true}).count(),1);
 assert.equal(payload.consent,true);assert.equal(payload.validation.overall_status,undefined);assert.equal(payload.validation.checks[0].cell,'C39');release();
 await page.getByRole('heading',{name:'Gemini explanation unavailable',exact:true}).waitFor();
 await page.getByRole('button',{name:'Explain findings with Gemini',exact:true}).click();
 await page.getByRole('heading',{name:'Explanation of findings',exact:true}).waitFor();
 await page.getByText('Enter the verified actual value at Monthly PPR!C39.',{exact:false}).waitFor();
 let state=await page.evaluate(()=>JSON.parse(localStorage.getItem('finagenticai.workspace.v3')));
 assert.equal(state.reports.find(r=>r.id===seeded.id).validationStatus,'Failed');
 await page.evaluate(id=>{const key='finagenticai.workspace.v3',w=JSON.parse(localStorage.getItem(key)),r=w.reports.find(r=>r.id===id);r.schemaValidationResult=null;r.validationResult=null;r.issues=[];r.geminiExplanation=null;r.validationError='Old runtime error';r.originalWorkbook={receipt:'synthetic-receipt'};localStorage.setItem(key,JSON.stringify(w));},seeded.id);
 await page.reload();await page.getByRole('button',{name:'Recheck stored workbook',exact:true}).click();
 await page.getByRole('heading',{name:'Validation findings',exact:true}).waitFor();
 state=await page.evaluate(()=>JSON.parse(localStorage.getItem('finagenticai.workspace.v3')));
 const report=state.reports.find(r=>r.id===seeded.id);assert.equal(report.validationError,null);assert.equal(report.validationStatus,'Failed');assert.equal(report.revision,seeded.revision);assert.equal(state.reports.length,seeded.count);assert.equal(rechecks,1);assert.equal(uploads,0);
 await page.setViewportSize({width:390,height:844});await page.getByRole('heading',{name:'Validation findings',exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS: failure cells, Gemini pending/error/retry/success, unchanged failed result, stored-original recheck and mobile rendering. All API requests mocked.');
}finally{await browser?.close();dev.kill();}
