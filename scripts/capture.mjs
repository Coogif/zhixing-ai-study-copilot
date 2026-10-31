/** Capture the running product with isolated fictional data, never a personal browser profile. */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { createDevServer } from './dev-server.mjs';
import { handleCoach } from '../api/coach.mjs';
const server=createDevServer({coach:(req,res)=>handleCoach(req,res,{apiKey:''})});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const base=`http://127.0.0.1:${server.address().port}`;
const captured=[];
try {
  const context=await browser.newContext({viewport:{width:1440,height:1100},locale:'zh-CN',timezoneId:'Asia/Shanghai'});
  const page=await context.newPage();await page.goto(base);await page.locator('h1').waitFor();
  async function capture(file,label){await page.locator('h1').click();await page.keyboard.press('Control+Home');await page.locator('#toast.show').waitFor({state:'hidden'});await page.screenshot({path:`assets/${file}`,fullPage:true,animations:'disabled'});captured.push({file,label});}
  await capture('demo-dashboard.png','空数据总览，1440px');
  await page.locator('[data-action="seed"]').click();
  await capture('demo-with-data.png','8 次虚构作答、7 道首答、57%、4 道到期题');
  await page.locator('[data-action="start"]').last().click();
  await page.locator('[data-choice="0"]').click();await page.locator('[data-action="submit"]').click();
  await page.locator('[data-action="error-reason"][data-value="concept"]').click();
  await page.locator('[data-action="helpful"][data-value="no"]').click();
  await capture('demo-practice.png','虚构练习，错答、预写解析与可选自评');
  await page.locator('[data-view="review"]').click();
  await capture('demo-review.png','到期题、未到期错题、后续计划');
  await page.locator('.nav-item[data-view="product"]').click();
  await capture('demo-product.png','产品边界与指标计划');
  const mobile=await browser.newContext({viewport:{width:390,height:844},locale:'zh-CN',timezoneId:'Asia/Shanghai',isMobile:true,hasTouch:true});
  const phone=await mobile.newPage();await phone.goto(base);await phone.locator('[data-action="seed"]').click();
  await phone.locator('#toast.show').waitFor({state:'hidden'});
  await phone.screenshot({path:'assets/mobile-dashboard.png',fullPage:false,animations:'disabled'});captured.push({file:'mobile-dashboard.png',label:'390×844px 移动总览首屏，虚构演示数据'});
  await writeFile('assets/screenshots.json',JSON.stringify({capturedAt:new Date().toISOString(),timezone:'Asia/Shanghai',browser:'Chromium via Playwright (Windows uses installed Edge)',method:'Unmodified browser screenshots: desktop full-page and mobile viewport; isolated fictional records; no model call',images:captured},null,2)+'\n');
  console.log(`Captured ${captured.length} actual product screenshots.`);
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
