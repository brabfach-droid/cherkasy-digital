import {auditTheme,auditComponents} from './theme-audit.mjs';
import {preview} from 'vite';
import {chromium} from 'playwright';
import Chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const server=await preview({preview:{host:'127.0.0.1',port:5178,strictPort:true}});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||await Chromium.executablePath(),args:Chromium.args,headless:true});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.route('https://fonts.gstatic.com/**',r=>r.abort());
const base='http://127.0.0.1:5178/cherkasy-digital/';
for(const width of [1920,1440,1024,768,430,390,320]){
 await page.setViewportSize({width,height:1000});await page.goto(base);await page.locator('.category').first().waitFor();
 if(width<768){await page.getByRole('button',{name:'Відкрити меню'}).click()}
 const theme=page.getByLabel('Тема оформлення').filter({visible:true});await theme.selectOption('dark');
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
 await page.reload();await page.locator('.category').first().waitFor();assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'dark overflow '+width);
 await page.keyboard.press('Control+k');await page.getByRole('dialog').waitFor();
 assert.equal(await page.getByRole('dialog').count(),1,'one keyboard palette');
 await page.getByRole('dialog').getByRole('searchbox').fill('консульта');
 await page.getByRole('dialog').getByRole('option').filter({hasText:'консульта'}).first().waitFor();
 await page.keyboard.press('ArrowDown');const href=await page.locator('[role=option][aria-selected=true]').getAttribute('href');await page.keyboard.press('Enter');await page.waitForURL(u=>u.pathname===href,{waitUntil:'domcontentloaded'});
 await page.goto(base);await page.locator('.category').first().waitFor();
 await auditTheme(page,'home dark '+width);
 if(width===1440)await auditComponents(page);
 if(width===1440||width===390)await page.screenshot({path:'test-results/v3-dark-'+width+'.png',fullPage:true});
 await page.emulateMedia({reducedMotion:'reduce'});assert.ok(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches));await page.emulateMedia({reducedMotion:'no-preference'});
}
for(const path of ['services','services/demo-consultation','news','news/demo-portal','documents','documents/demo-guide','events','events/demo-event','now','appeals','auth/login','auth/register','help']){
 await page.goto(base+path);await page.locator('main h1').first().waitFor();await page.waitForTimeout(150);await auditTheme(page,path+' dark');
}
assert.deepEqual(errors,[]);console.log('PASS V3 public: seven widths, persisted dark theme, keyboard grouped search, one palette, reduced motion, no overflow/errors');
await browser.close();await new Promise(r=>server.httpServer.close(r));
