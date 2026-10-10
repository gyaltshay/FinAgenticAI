import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='D:/FinAgenticAI/docs/frontend-visual-review';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
try{
 await page.goto('http://127.0.0.1:5173/');await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:out+'/login.png',fullPage:true});
 await page.getByLabel('Password',{exact:true}).fill('test-only');await page.getByRole('button',{name:'Sign in →'}).click();
 for(const route of ['dashboard','monitoring','companies','users','readiness']){await page.goto('http://127.0.0.1:5173/#'+route);await page.getByRole('heading',{level:1}).waitFor();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:out+'/'+route+'.png',fullPage:true});}
 assert.ok((await page.locator('header .workspace-identity img').getAttribute('src')).includes('DHI.webp'));
 assert.ok(await page.evaluate(()=>document.fonts.check('12px Inter')));
 assert.ok(await page.evaluate(()=>Array.from(document.querySelectorAll('h1,h2,h3,input,select,button,td,.status-text')).every(e=>getComputedStyle(e).fontFamily.startsWith('Inter'))));
 await page.goto('http://127.0.0.1:5173/#monitoring');await page.getByRole('heading',{level:1}).waitFor();assert.ok(await page.locator('.mark-error').count()>0);assert.ok(await page.locator('.mark-success').count()>0);assert.ok(await page.locator('.mark-waiting').count()>0);await page.locator('header').screenshot({path:out+'/admin-header.png'});
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173/#dashboard');await page.screenshot({path:out+'/mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Logout',exact:true}).click();await page.getByLabel('Workspace role').selectOption('subsidiary');await page.getByLabel('Password',{exact:true}).fill('test-only');await page.getByRole('button',{name:'Sign in →'}).click();await page.getByRole('heading',{name:'Dashboard',exact:true}).waitFor();assert.ok((await page.locator('header .workspace-identity img').getAttribute('src')).includes('TTPL'));await page.locator('header').screenshot({path:out+'/company-header.png'});
 console.log('Visual review passed: DHI/TTPL header logos, unified Inter font, distinct status symbols. Screenshots saved.');
}finally{await browser.close();}
