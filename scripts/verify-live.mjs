/** Explicit public deployment smoke test; all records are disposable and context-isolated. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base=new URL(process.argv[2]||'https://coogif.github.io/zhixing-ai-study-copilot/');
if(base.protocol!=='https:')throw Error('Use the explicit HTTPS deployment URL');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[],external=[],checks=[];
const nav=(page,view)=>page.locator(`.nav-item[data-view="${view}"]`).click();
const count=async page=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhixing-study-mvp-v1'))?.history.length||0);
const record=name=>checks.push(name);
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',timezoneId:'Asia/Shanghai'});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).origin!==base.origin)external.push(r.url());});
  assert.equal((await page.goto(base.href)).status(),200);
  await page.locator('h1').waitFor();record('HTTPS homepage 200');
  await page.locator('[data-action="seed"]').click();
  assert.deepEqual(await page.locator('.stat-value').allTextContents(),['8题次','57%','7 / 12','4道']);
  record('Fictional demonstration metrics');
  await page.locator('#toast.show').waitFor({state:'hidden'});
  await page.screenshot({path:'assets/published-desktop.png',animations:'disabled'});
  await page.locator('[data-action="start"]').last().click();
  assert.equal(await page.locator('.question-card h2').innerText(),'容斥 · 交集处理');
  await page.locator('[data-choice="0"]').click();await page.locator('[data-action="submit"]').click();
  assert.equal(await count(page),9);
  await page.locator('[data-action="error-reason"][data-value="concept"]').click();
  assert.equal(await page.locator('[data-action="ai"]').isDisabled(),true);
  record('Explained recommendation, submission, self-feedback, AI explicitly disabled');
  await nav(page,'review');await page.locator('[data-qid="s2"]').click();
  await page.locator('[data-choice="1"]').click();await page.locator('[data-action="submit"]').click();
  await nav(page,'dashboard');
  assert.equal(await page.locator('.stat-value').nth(1).innerText(),'50%');
  await page.reload();assert.equal(await count(page),10);
  record('Review correction preserves first-attempt accuracy; reload persists records');
  page.once('dialog',d=>d.dismiss());await page.locator('#reset-button').click();assert.equal(await count(page),10);
  page.once('dialog',d=>d.accept());await page.locator('#reset-button').click();assert.equal(await count(page),0);
  record('Reset cancellation and confirmation');
  for(const [view,label]of Object.entries({practice:'智能练习',review:'复习计划',product:'产品方案与决策'})){
    await nav(page,view);await page.reload();assert.equal(await page.locator('h1').innerText(),label);
  }
  record('Hash routes survive direct refresh');
  const mobile=await browser.newContext({viewport:{width:390,height:844},locale:'zh-CN',timezoneId:'Asia/Shanghai',isMobile:true,hasTouch:true});
  const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));
  await phone.goto(base.href);await phone.locator('[data-action="seed"]').click();
  await phone.locator('#toast.show').waitFor({state:'hidden'});
  await phone.screenshot({path:'assets/published-mobile.png',animations:'disabled'});
  for(const width of [320,390]){
    await phone.setViewportSize({width,height:844});
    for(const view of ['dashboard','practice','review','product']){
      await nav(phone,view);
      assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width}px ${view}`);
    }
  }
  record('320/390px: four live pages fit viewport');
  for(const file of ['.env','api/coach.mjs','scripts/dev-server.mjs']){
    const response=await context.request.get(new URL(file,base).href);assert.equal(response.status(),404,file);
  }
  record('Environment/API/development files absent from public static site');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  const result={verifiedAt:new Date().toISOString(),url:base.href,browser:await browser.version(),checks,scriptErrors:errors.length,externalPageRequests:external.length,note:'Isolated fictional records only; no model call, production user, or educational-effect evaluation'};
  await mkdir('test-results',{recursive:true});
  await writeFile('test-results/live-verification.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
