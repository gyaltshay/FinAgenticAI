import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildScopePackage,makeInsightFile,importInsightFile} from '../shared/scopedReports.mjs';
import {generateReport,reportMarkdown} from '../server/reporting.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:5188/',dev=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5188','--strictPort'],{cwd:new URL('../',import.meta.url),windowsHide:true,stdio:'ignore'});
let browser,insightCalls=0,reportCalls=0,failOnce=true,held=false,release;
try{
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}if(i===59)throw Error('Vite did not start');await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/api/**',async route=>{
  const url=route.request().url();
  if(url.endsWith('/scoped/insights')){
   insightCalls++;const {cycle,scope}=route.request().postDataJSON();
   if(held)await new Promise(r=>release=r);
   if(insightCalls===3&&failOnce){failOnce=false;return route.fulfill({status:503,json:{error:'Synthetic Gemini overload'}});}
   const pkg=buildScopePackage(cycle,scope),file=makeInsightFile({report_id:cycle.id,reporting_period:cycle.period,overall_summary:'Financial performance is ready for review.',insights:[{id:'i1',type:'management_summary',severity:'INFO',title:'Revenue overview',interpretation:'Review revenue against the recorded expenses.',suggested_action:'Verify the source figures with finance.',source_references:[pkg.references[0]],evidence:[{metric:'revenue',value:pkg.metrics.revenue}],requires_human_review:true}],limitations:['Synthetic browser test.'],review_status:'REVIEW_REQUIRED'},pkg);
   return route.fulfill({json:file});
  }
  if(url.endsWith('/scoped/report')){reportCalls++;const {cycle,insightFile}=route.request().postDataJSON(),report=generateReport(importInsightFile(insightFile,cycle).input);return route.fulfill({json:{report,markdown:reportMarkdown(report)}});}
  return route.fulfill({json:{configured:false}});
 });
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('finagenticai.workspace.v3')));
 await page.goto(base);await page.getByLabel('Password',{exact:true}).fill('test');await page.getByRole('button',{name:'Sign in →',exact:true}).click();
 await page.goto(base+'#analysis');await page.getByRole('heading',{name:'Insights are waiting for the complete reporting cycle',exact:true}).waitFor();assert.equal(insightCalls,0);
 await page.goto(base+'#readiness');await page.getByRole('button',{name:'Prepare reporting cycle',exact:true}).click();await page.getByRole('button',{name:'Confirm preparation',exact:true}).click();
 await page.getByText('Automatic preparation paused',{exact:true}).waitFor();assert.equal(insightCalls,3);assert.equal(reportCalls,2);assert.equal((await state()).managementReports.length,2);assert.equal((await state()).publishedResults.length,0);
 await page.reload();await page.getByText('Automatic preparation paused',{exact:true}).waitFor();assert.equal(insightCalls,3);
 await page.getByRole('button',{name:'Retry remaining generation',exact:true}).click();await page.getByText('Insights and reports are ready for review',{exact:true}).waitFor();
 const w=await state(),total=w.managementReports.length;assert.ok(total>23);assert.equal(reportCalls,total);assert.equal(insightCalls,total+1);assert.ok(w.managementReports.every(e=>e.status==='Pending Approval'));assert.equal(w.publishedResults.length,0);
 await page.goto(base+'#analysis');await page.getByRole('button',{name:'Regenerate insights',exact:true}).waitFor();
 const contrast=await page.locator('.insight-document .summary-list h3').evaluate(e=>({font:getComputedStyle(e).fontSize,color:getComputedStyle(e).color,bodyColor:getComputedStyle(e.nextElementSibling).color}));assert.equal(contrast.font,'17px');assert.equal(contrast.bodyColor,'rgb(37, 52, 72)');
 await fs.mkdir(new URL('../../.local/agent-results-review/',import.meta.url),{recursive:true});await page.screenshot({path:new URL('../../.local/agent-results-review/insights.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
 await page.getByLabel('Insight scope').selectOption('group');await page.getByRole('heading',{name:/Revenue overview/}).waitFor();assert.equal(await page.getByRole('button',{name:'Regenerate insights',exact:true}).count(),1);
 await page.getByRole('button',{name:'View report',exact:true}).click();await page.locator('.reporting-draft').waitFor();assert.equal(await page.getByLabel('Report scope').inputValue(),'group');
 const approval=page.getByRole('button',{name:'Approve report',exact:true}),revision=page.getByRole('button',{name:'Request revision',exact:true});assert.ok((await approval.boundingBox()).height<42);assert.ok((await revision.boundingBox()).height<42);
 await page.getByLabel('Report scope').selectOption('company');await page.getByLabel('Report entity').selectOption('TTPL');await page.locator('.reporting-draft').waitFor();assert.ok((await page.locator('.reporting-draft').innerText()).includes('TTPL'));
 await page.screenshot({path:new URL('../../.local/agent-results-review/report.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
 await approval.click();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();assert.equal((await state()).publishedResults.length,0);
 await approval.click();await page.getByRole('button',{name:'Confirm approval',exact:true}).click();await page.getByText('Approved and released by',{exact:false}).waitFor();assert.equal((await state()).publishedResults.length,1);
 const before=insightCalls;await page.reload();await page.getByText('Insights and reports are ready for review',{exact:true}).waitFor();assert.equal(insightCalls,before);
 await page.getByRole('button',{name:'Regenerate report',exact:true}).click();await page.getByRole('button',{name:'Regenerate report',exact:true}).waitFor({state:'visible'});
 await page.goto(base+'#analysis');held=true;release=undefined;await page.getByRole('button',{name:'Regenerate insights',exact:true}).click();await page.getByRole('button',{name:'Generating insights…',exact:true}).waitFor();await page.evaluate(()=>window.dispatchEvent(new Event('finagenticai-insights-changed')));assert.equal(await page.getByRole('button',{name:'Generating insights…',exact:true}).count(),1);while(!release)await new Promise(r=>setTimeout(r,10));held=false;release();await page.getByRole('button',{name:'Regenerate insights',exact:true}).waitFor();assert.equal(insightCalls,before+1);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.goto(base+'#management');await page.locator('.reporting-draft').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.emulateMedia({media:'print'});assert.equal(await page.locator('.reporting-draft h2').evaluate(e=>getComputedStyle(e).visibility),'visible');await page.emulateMedia({media:'screen'});
 // An in-flight result must not be saved after a correction invalidates readiness.
 held=true;release=undefined;await page.evaluate(async()=>{const m=await import('/src/services/cycle.js');let w=JSON.parse(localStorage.getItem('finagenticai.workspace.v3'));w=m.submitVersion(w,{company:'TTPL',periodId:w.currentPeriod,file:{name:'correction.xlsx',size:20}},{role:'subsidiary',company:'TTPL'});w=m.generateFinal(m.completeDemoReports(w,w.currentPeriod),w.currentPeriod);localStorage.setItem('finagenticai.workspace.v3',JSON.stringify(w));});await page.reload();
 await page.waitForFunction(()=>document.querySelector('.agent-progress')?.textContent.includes('Generating insights'));const reportCount=(await state()).managementReports.length;
 while(!release)await new Promise(r=>setTimeout(r,10));
 await page.evaluate(async()=>{const {submitVersion}=await import('/src/services/cycle.js'),key='finagenticai.workspace.v3';const w=JSON.parse(localStorage.getItem(key)),next=submitVersion(w,{company:'TTPL',periodId:w.currentPeriod,file:{name:'new-correction.xlsx',size:20}},{role:'subsidiary',company:'TTPL'});localStorage.setItem(key,JSON.stringify(next));window.dispatchEvent(new StorageEvent('storage',{key,newValue:JSON.stringify(next)}));});
 await page.getByRole('heading',{name:'Reporting is waiting for the complete reporting cycle',exact:true}).waitFor();held=false;release();await page.waitForTimeout(300);assert.equal((await state()).managementReports.length,reportCount);assert.deepEqual(errors,[]);
 console.log(`PASS: ${total} scopes generated automatically; pause, persisted retry, refresh, selection, manual regeneration, manual approval, readable styles, compact controls, mobile/print, correction cancellation. Mock APIs only.`);
}finally{await browser?.close();dev.kill();}
