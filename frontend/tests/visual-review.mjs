import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='D:/FinAgenticAI/docs/frontend-visual-review';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
try{
 await page.goto('http://127.0.0.1:5173/');await page.screenshot({path:out+'/login.png',fullPage:true});
 await page.getByLabel('Password',{exact:true}).fill('test-only');await page.getByRole('button',{name:'Sign in →'}).click();
 for(const route of ['dashboard','monitoring','companies','users','readiness']){await page.goto('http://127.0.0.1:5173/#'+route);await page.getByRole('heading',{level:1}).waitFor();await page.screenshot({path:out+'/'+route+'.png',fullPage:true});}
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173/#dashboard');await page.screenshot({path:out+'/mobile.png',fullPage:true});
 console.log('Visual review screenshots saved.');
}finally{await browser.close();}
