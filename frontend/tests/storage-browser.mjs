import {spawnApi} from './api-process.mjs';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {S3Client,DeleteObjectCommand} from '@aws-sdk/client-s3';
const root=fileURLToPath(new URL('../../',import.meta.url)).replace(/[\\/]$/,''),front=root+'/frontend',base='http://127.0.0.1:3093',receipts=[];
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const bytes=execFileSync('python',['-c',"import test_ttpl_validation as t,sys;sys.stdout.buffer.write(t.workbook_bytes())"],{cwd:front+'/tests',windowsHide:true});
let api,vite,browser;const children=[];
function startApi(){api=spawnApi({cwd:front,env:{...process.env,FINAGENTIC_DATABASE_DISABLED:'1',GEMINI_PORT:'3093'},stdio:'ignore',windowsHide:true});children.push(api);}
async function wait(url){for(let i=0;i<80;i++){try{const r=await fetch(url);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,200));}throw new Error('Test service did not start: '+url);}
async function post(path,data,expected=200){const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});assert.equal(r.status,expected,await r.clone().text());return r;}
async function stop(child){if(child&&!child.killed){child.kill();await new Promise(r=>child.once('exit',r));}}
try{
 startApi();await wait(base+'/api/storage/health');
 const id='storage-check-'+crypto.randomUUID(),input={submissionId:id,company:'TTPL',period:'August 2026',version:1,uploadedBy:'Synthetic integration check',fileName:'synthetic-original.xlsx',fileBase64:bytes.toString('base64')};
 for(const version of [1,2]){const receipt=(await (await post('/api/storage/workbooks',{...input,version} ,201)).json()).originalWorkbook;receipts.push(receipt);assert.deepEqual(Buffer.from(await (await post('/api/storage/workbooks/download',{originalWorkbook:receipt})).arrayBuffer()),bytes);}
 assert.notEqual(receipts[0].key,receipts[1].key);
 const result=await (await post('/api/gemini/validate',{...input,fileBase64:undefined,originalWorkbook:receipts[0]})).json();assert.ok(result.validation_status);assert.equal(result.workbook.filename,input.fileName);
 await post('/api/gemini/validate',{...input,version:9,fileBase64:undefined,originalWorkbook:receipts[0]},409);
 await post('/api/storage/workbooks/download',{originalWorkbook:{...receipts[0],accessToken:'forged.receipt'}},403);
 await post('/api/storage/workbooks/download',{},403);
 const cross=await fetch(base+'/api/storage/workbooks',{method:'POST',headers:{'content-type':'application/json',origin:'http://untrusted.example'},body:JSON.stringify(input)});assert.equal(cross.status,403);
 await stop(api);startApi();await wait(base+'/api/storage/health');assert.deepEqual(Buffer.from(await (await post('/api/storage/workbooks/download',{originalWorkbook:receipts[0]})).arrayBuffer()),bytes);
 console.log('Live MinIO API: separate versions, exact original bytes, stored-byte validation, denied tampering, origin checks, and API restart persistence passed.');
 vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5184','--strictPort'],{cwd:front,env:{...process.env,FINAGENTIC_API_URL:base},stdio:'ignore',windowsHide:true});children.push(vite);await wait('http://127.0.0.1:5184/');
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});const page=await browser.newPage({acceptDownloads:true});page.on('pageerror',e=>{throw e;});
 await page.goto('http://127.0.0.1:5184/');await page.getByLabel('Workspace role').selectOption('subsidiary');await page.getByLabel('Company',{exact:true}).selectOption('TTPL');await page.getByLabel('Password',{exact:true}).fill('test');await page.getByRole('button',{name:'Sign in'}).click();
 for(let i=0;i<2;i++){
  await page.getByRole('button',{name:'Upload Report',exact:true}).click();await page.locator('input[type=file]').setInputFiles({name:'synthetic-original.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:bytes});
  const storedPromise=page.waitForResponse(r=>r.url().endsWith('/api/storage/workbooks')&&r.request().method()==='POST');
  const validatedPromise=page.waitForResponse(r=>r.url().endsWith('/api/gemini/validate')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Upload and Validate'}).click();const stored=await storedPromise;assert.equal(stored.status(),201);const receipt=(await stored.json()).originalWorkbook;receipts.push(receipt);assert.equal((await validatedPromise).status(),200);
  await page.getByRole('button',{name:'Download original',exact:true}).waitFor();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download original',exact:true}).click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'synthetic-original.xlsx');assert.deepEqual(await readFile(await download.path()),bytes);
 }
 assert.equal(receipts[3].version,receipts[2].version+1);assert.notEqual(receipts[2].key,receipts[3].key);
 await page.reload();await page.getByRole('button',{name:'Download original',exact:true}).waitFor();
 await page.getByRole('button',{name:'My Submissions',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Download original',exact:true}).count(),2);
 await page.getByRole('button',{name:'Upload Report',exact:true}).click();await page.locator('input[type=file]').setInputFiles({name:'synthetic-original.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:bytes});
 let validationCalls=0;page.on('request',r=>{if(r.url().endsWith('/api/gemini/validate'))validationCalls++;});await page.route('**/api/storage/workbooks',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'MinIO unavailable for test.'})}));
 await page.getByRole('button',{name:'Upload and Validate'}).click();await page.getByRole('heading',{name:'Validation unavailable',exact:true}).waitFor();assert.equal(validationCalls,0);assert.equal(await page.getByRole('button',{name:'Download original',exact:true}).count(),0);
 console.log('Browser: upload, correction version, exact download, refresh, history, and storage failure blocking validation passed.');
}finally{
 if(browser)await browser.close();for(const child of children)await stop(child);
 const env=Object.fromEntries((await readFile(root+'/.env.storage.local','utf8')).split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const at=l.indexOf('=');return [l.slice(0,at),l.slice(at+1)];}));
 const s3=new S3Client({endpoint:env.MINIO_ENDPOINT,region:'us-east-1',forcePathStyle:true,credentials:{accessKeyId:env.MINIO_ROOT_USER,secretAccessKey:env.MINIO_ROOT_PASSWORD}});
 for(const receipt of receipts)await s3.send(new DeleteObjectCommand({Bucket:receipt.bucket,Key:receipt.key}));s3.destroy();console.log('Removed only the '+receipts.length+' synthetic workbooks created by this check.');
}
