import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 const response=await page.goto('https://gyaltshay.github.io/FinAgenticAI/',{waitUntil:'networkidle'});assert.equal(response.status(),200);
 await page.getByRole('button',{name:'Sign in →'}).waitFor();assert.equal(await page.getByLabel('Demo workspace role').locator('option').count(),2);
 await page.getByLabel('Demo password',{exact:true}).fill('test-only');await page.getByRole('button',{name:'Sign in →'}).click();await page.getByRole('heading',{name:'Dashboard',exact:true}).waitFor();
 await page.getByRole('button',{name:'Companies & Sectors',exact:true}).click();
 const images=await page.locator('.company-card img').evaluateAll(imgs=>imgs.map(i=>i.src));assert.equal(images.length,23);assert.ok(images.every(src=>src.includes('/FinAgenticAI/logos/')));
 const asset=await page.request.get('https://gyaltshay.github.io/FinAgenticAI/logos/TTPL(1).webp');assert.equal(asset.status(),200);assert.ok((await asset.body()).length>0);assert.deepEqual(errors,[]);
 console.log('Live GitHub Pages verified: HTTP 200, React login/dashboard, correct company logo paths, TTPL image response, no page errors.');
}finally{await browser.close();}


