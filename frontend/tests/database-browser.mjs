import {spawnApi} from './api-process.mjs';
import assert from 'node:assert/strict';
import pg from 'pg';
import {spawn,execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {S3Client,DeleteObjectCommand} from '@aws-sdk/client-s3';
import {databaseConfig,createDatabase} from './database-adapter.mjs';
import {python as backendPython} from '../scripts/python-runtime.mjs';
import {initialCycleWorkspace} from '../src/services/cycle.js';
import {projectDatabaseRecords} from '../shared/database-records.mjs';

const config=await databaseConfig(),front=fileURLToPath(new URL('../',import.meta.url)),root=fileURLToPath(new URL('../../',import.meta.url));
const testName='finagenticai_check_'+randomBytes(8).toString('hex'),base='http://127.0.0.1:3095';
const admin=new pg.Client({...config.connection,database:'postgres',user:config.values.PGADMIN_USER||'postgres',password:config.values.PGADMIN_PASSWORD});
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let created=false,db,pool,browser,api,vite,original;const children=[];
async function stop(child){if(child&&child.exitCode===null&&!child.killed){child.kill();await new Promise(resolve=>child.once('exit',resolve));}}
async function until(check){for(let i=0;i<100;i++){try{if(await check())return;}catch{}await new Promise(resolve=>setTimeout(resolve,150));}throw new Error('Database/browser check timed out.');}
function startApi(){api=spawnApi({cwd:front,env:{...process.env,FINAGENTIC_DATABASE_DISABLED:'0',PGDATABASE:testName,GEMINI_PORT:'3095'},stdio:'ignore',windowsHide:true});children.push(api);}
async function login(page,role='admin'){
 await page.goto('http://127.0.0.1:5185/');await page.getByLabel('Workspace role').selectOption(role);
 if(role==='subsidiary')await page.getByLabel('Company',{exact:true}).selectOption('TTPL');
 await page.getByLabel('Password',{exact:true}).fill('prototype-check');await page.getByRole('button',{name:'Sign in'}).click();await page.getByRole('button',{name:'Logout',exact:true}).waitFor();
}
try{
 assert.ok(config.configured,'Complete the local PostgreSQL setup first.');await admin.connect();
 const ddl=(await admin.query("SELECT format('CREATE DATABASE %I OWNER %I',$1::text,$2::text) AS sql",[testName,config.connection.user])).rows[0].sql;await admin.query(ddl);created=true;
 execFileSync(backendPython,['-m','backend.manage','setup'],{cwd:root,env:{...process.env,PGDATABASE:testName},windowsHide:true,stdio:'pipe'});pool=new pg.Pool({...config.connection,database:testName});
 db=createDatabase({configured:true,connection:{...config.connection,database:testName},pool});
 const initial=projectDatabaseRecords(initialCycleWorkspace());await db.save({revision:0,records:initial});
 assert.equal((await db.read()).records.companies.length,25);await assert.rejects(db.save({revision:0,records:initial}),{status:409});
 await pool.query("ALTER TABLE finagenticai.companies ADD CONSTRAINT synthetic_rollback_check CHECK(name<>'synthetic-rollback')");
 const invalid=structuredClone(initial);invalid.companies[0].name='synthetic-rollback';await assert.rejects(db.save({revision:1,records:invalid}));assert.equal((await db.read()).revision,1);assert.deepEqual((await db.read()).records,initial);
 await pool.query('ALTER TABLE finagenticai.companies DROP CONSTRAINT synthetic_rollback_check');
 assert.equal((await pool.query('SELECT rolsuper FROM pg_roles WHERE rolname=current_user')).rows[0].rolsuper,false);
 // Reset only this isolated test database to exercise browser seeding of an empty database.
 assert.match(testName,/^finagenticai_check_[0-9a-f]{16}$/);
 await pool.query('TRUNCATE finagenticai.submissions,finagenticai.users,finagenticai.reporting_periods,finagenticai.companies CASCADE');await pool.query('UPDATE finagenticai.workspace_revision SET revision=0 WHERE id=1');
 startApi();await until(async()=>{const r=await fetch(base+'/api/database/health');return r.ok&&(await r.json()).available;});
 vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5185','--strictPort'],{cwd:front,env:{...process.env,FINAGENTIC_API_URL:base},stdio:'ignore',windowsHide:true});children.push(vite);await until(async()=>(await fetch('http://127.0.0.1:5185/')).ok);
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const adminContext=await browser.newContext(),page=await adminContext.newPage();page.on('pageerror',error=>{throw error;});await login(page);
 await page.getByRole('button',{name:'Companies & Sectors',exact:true}).click();await page.locator('.company-card').filter({hasText:'TTPL'}).click();await page.getByLabel('Company name',{exact:true}).fill('TTPL database check');await page.getByRole('button',{name:'Save company',exact:true}).click();
 await until(async()=>(await db.read()).records.companies.find(c=>c.id==='TTPL').name==='TTPL database check');
 const officerContext=await browser.newContext({acceptDownloads:true}),officer=await officerContext.newPage();await login(officer,'subsidiary');assert.ok((await officer.locator('body').innerText()).includes('TTPL database check'));
 const bytes=execFileSync('python',['-c','import test_ttpl_validation as t,sys;sys.stdout.buffer.write(t.workbook_bytes())'],{cwd:front+'/tests',windowsHide:true});
 await officer.getByRole('button',{name:'Upload Report',exact:true}).click();await officer.locator('input[type=file]').setInputFiles({name:'database-synthetic.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:bytes});
 const stored=officer.waitForResponse(r=>r.url().endsWith('/api/storage/workbooks')&&r.request().method()==='POST');const validated=officer.waitForResponse(r=>r.url().endsWith('/api/gemini/validate'));
 await officer.getByRole('button',{name:'Upload and Validate'}).click();const storedResponse=await stored;assert.equal(storedResponse.status(),201);original=(await storedResponse.json()).originalWorkbook;assert.equal((await validated).status(),200);
 await until(async()=>{const r=(await db.read()).records.submissions.find(r=>r.id===original.submissionId);return r?.originalWorkbook&&r.validationStatus!=='Validating';});
 const row=(await pool.query('SELECT record,original_workbook FROM finagenticai.submissions WHERE id=$1',[original.submissionId])).rows[0];assert.equal(row.original_workbook.key,original.key);for(const key of ['data','validationResult','schemaValidationResult','geminiExplanation','summary','insights'])assert.ok(!(key in row.record));
 await adminContext.close();await officerContext.close();await stop(api);startApi();await until(async()=>(await fetch(base+'/api/database/health')).ok);
 const fresh=await browser.newContext({acceptDownloads:true}),freshPage=await fresh.newPage();await login(freshPage,'subsidiary');await freshPage.goto('http://127.0.0.1:5185/#validation/'+original.submissionId);await freshPage.getByRole('button',{name:'Download original',exact:true}).waitFor();
 const downloadPromise=freshPage.waitForEvent('download');await freshPage.getByRole('button',{name:'Download original',exact:true}).click();const download=await downloadPromise;assert.deepEqual(await readFile(await download.path()),bytes);
 const restored=await freshPage.evaluate(id=>JSON.parse(localStorage.getItem('finagenticai.workspace.v3')).reports.find(r=>r.id===id),original.submissionId);assert.deepEqual(restored.data,{});assert.equal(restored.validationResult,null);await fresh.close();
 const current=await db.read();const raced=await Promise.allSettled([db.save(current),db.save(current)]);assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);assert.equal(raced.find(r=>r.status==='rejected').reason.status,409);
 const retained=await db.read(),removed=structuredClone(retained);removed.records.submissions=removed.records.submissions.filter(r=>r.id!==original.submissionId);await assert.rejects(db.save(removed),{status:409});
 console.log('PostgreSQL live checks passed: non-superuser role, transactions/rollback, stale-writer rejection, company edits, separate browser restore, MinIO reference persistence, original download after API restart, and agent-result exclusion.');
}finally{
 if(browser)await browser.close();for(const child of children)await stop(child);if(db)await db.close();else if(pool)await pool.end();
 if(original){const values=Object.fromEntries((await readFile(root+'/.env.storage.local','utf8')).split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));const s3=new S3Client({endpoint:values.MINIO_ENDPOINT,region:'us-east-1',forcePathStyle:true,credentials:{accessKeyId:values.MINIO_ROOT_USER,secretAccessKey:values.MINIO_ROOT_PASSWORD}});await s3.send(new DeleteObjectCommand({Bucket:original.bucket,Key:original.key}));s3.destroy();}
 if(created){assert.match(testName,/^finagenticai_check_[0-9a-f]{16}$/);const sql=(await admin.query("SELECT format('DROP DATABASE %I WITH (FORCE)',$1::text) AS sql",[testName])).rows[0].sql;await admin.query(sql);}
 await admin.end();console.log('Cleaned up only this check’s temporary database and synthetic workbook.');
}
