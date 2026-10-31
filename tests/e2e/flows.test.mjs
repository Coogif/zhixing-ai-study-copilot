import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDevServer } from '../../scripts/dev-server.mjs';
import { handleCoach } from '../../api/coach.mjs';
import { QUESTIONS } from '../../src/questions.js';
import { STORAGE_KEY } from '../../src/storage.js';

let server, browser, base;
before(async()=>{
  execFileSync(process.execPath,['scripts/build-preview.mjs']);
  execFileSync(process.execPath,['scripts/build-pages.mjs']);
  server=createDevServer({coach:(req,res)=>handleCoach(req,res,{apiKey:''})});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});

async function session(t, saved) {
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  t.after(()=>context.close());
  if(saved!==undefined)await context.addInitScript(({key,saved})=>localStorage.setItem(key,JSON.stringify(saved)),{key:STORAGE_KEY,saved});
  const page=await context.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  t.after(()=>assert.deepEqual(errors,[]));
  await page.goto(base);
  await page.locator('h1').waitFor();
  return {page,context};
}
const nav=(page,view)=>page.locator(`.nav-item[data-view="${view}"]`).click();
const act=(page,name)=>page.locator(`[data-action="${name}"]`).last().click();
const count=async page=>JSON.parse(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY))?.history.length||0;
const text=page=>page.locator('#app').innerText();

test('demo → recommendation → wrong answer → self feedback → review correction → persisted/reset',async t=>{
  const {page}=await session(t);
  assert.match(await text(page),/尚无作答数据/);
  await act(page,'seed');
  assert.deepEqual(await page.locator('.stat-value').allTextContents(),['8题次','57%','7 / 12','4道']);
  await act(page,'start');
  assert.equal(await page.locator('.question-card h2').innerText(),'容斥 · 交集处理');
  assert.equal(await page.locator('[data-action="submit"]').isDisabled(),true);
  assert.equal(await page.locator('.method-box').count(),0);
  await page.locator('[data-choice="0"]').click();
  await act(page,'submit');
  assert.equal(await count(page),9);
  assert.match(await page.locator('.answer-result').innerText(),/没答对/);
  assert.equal(await page.locator('[data-action="submit"]').count(),0);
  await page.locator('[data-action="error-reason"][data-value="concept"]').click();
  await page.locator('[data-action="helpful"][data-value="no"]').click();
  const saved=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY));
  assert.equal(saved.history.at(-1).errorReason,'concept');
  assert.equal(saved.history.at(-1).helpful,'no');
  await nav(page,'review');
  const ids=await page.locator('[data-review-id]').evaluateAll(els=>els.map(e=>e.dataset.reviewId));
  assert.equal(ids.length,new Set(ids).size);
  await page.locator('[data-qid="s2"]').click();
  assert.equal(new URL(page.url()).hash,'#practice');
  await page.locator('[data-choice="1"]').click();await act(page,'submit');
  assert.equal(await count(page),10);
  await nav(page,'dashboard');
  assert.equal(await page.locator('.stat-value').nth(1).innerText(),'50%');
  await page.reload();assert.equal(await count(page),10);
  page.once('dialog',d=>d.dismiss());await page.locator('#reset-button').click();
  assert.equal(await count(page),10);
  page.once('dialog',d=>d.accept());await page.locator('#reset-button').click();
  assert.equal(await count(page),0);assert.equal(new URL(page.url()).hash,'#dashboard');
  assert.equal(await page.locator('.data-notice').count(),0);
});

test('all 12 new questions can be covered exactly once and reach completion',async t=>{
  const {page}=await session(t);await act(page,'start');
  const seen=new Set();
  for(let i=0;i<QUESTIONS.length;i++){
    const title=await page.locator('.question-card h2').innerText();
    assert.ok(!seen.has(title),title);seen.add(title);
    const q=QUESTIONS.find(q=>q.title===title);
    await page.locator(`[data-choice="${q.answer}"]`).click();
    await act(page,'submit');await act(page,'next');
  }
  assert.equal(seen.size,12);assert.match(await text(page),/本轮练习完成/);
});

test('last review correction ends the queue and never introduces a new question',async t=>{
  const h={history:[{questionId:'g1',topic:'growth',selected:0,correct:false,at:Date.now()-2*86400000}],demo:false};
  const {page}=await session(t,h);await nav(page,'review');await act(page,'review-start');
  await page.locator('[data-choice="1"]').click();await act(page,'submit');await act(page,'next');
  assert.match(await text(page),/本轮复习完成/);
  await nav(page,'review');assert.equal(await page.locator('[data-review-id="g1"]').count(),1);
  assert.match(await text(page),/首答错题 1 道 · 最近已答对 1 道/);
});

test('tampered and malformed storage cannot inject markup or crash the UI',async t=>{
  const {page}=await session(t,{history:[{questionId:'<img src=x onerror=alert(1)>',topic:'growth',correct:true,selected:0,at:Date.now()}]});
  assert.match(await text(page),/尚无作答数据/);
  await page.evaluate(key=>localStorage.setItem(key,'null'),STORAGE_KEY);await page.reload();
  assert.match(await text(page),/尚无作答数据/);
});

test('storage denial remains usable and clearing failure is reported honestly',async t=>{
  const {page,context}=await session(t);
  await context.addInitScript(()=>{
    for(const method of ['getItem','setItem','removeItem'])Storage.prototype[method]=()=>{throw Error('test storage blocked');};
  });
  await page.reload();assert.match(await text(page),/本地记录不可用/);
  await act(page,'start');await page.locator('[data-choice="1"]').click();await act(page,'submit');
  assert.match(await text(page),/尚未持久保存/);
  page.once('dialog',d=>d.accept());await page.locator('#reset-button').click();
  assert.match(await text(page),/无法清除浏览器持久记录/);
});

test('responsive dashboard/practice/review/product fit 320, 390 and 768 px',async t=>{
  const {page}=await session(t);await act(page,'seed');
  for(const width of [320,390,768]){
    await page.setViewportSize({width,height:844});
    for(const view of ['dashboard','practice','review','product']){
      await nav(page,view);
      const dimensions=await page.evaluate(()=>({viewport:innerWidth,content:document.documentElement.scrollWidth}));
      assert.ok(dimensions.content<=dimensions.viewport,`${width}px ${view}: ${JSON.stringify(dimensions)}`);
      if(view==='practice'){
        for(const box of await page.locator('.option').all())assert.ok((await box.boundingBox()).height>=44);
      }
    }
  }
});

test('unconfigured and offline preview never pretend to provide model output',async t=>{
  const {page}=await session(t);await act(page,'start');
  await page.locator('[data-choice="1"]').click();await act(page,'submit');
  assert.equal(await page.locator('[data-action="ai"]').isDisabled(),true);
  assert.match(await text(page),/当前未启用模型讲解/);
  await page.goto(`${base}/preview.html#practice`);
  assert.equal(await page.locator('[data-action="ai"]').isDisabled(),true);
});

test('an old AI response cannot overwrite a later answer to the same question',async t=>{
  const {page}=await session(t);
  await page.route('**/api/capabilities',r=>r.fulfill({json:{ai:true}}));
  let release, requested;
  const started=new Promise(resolve=>{requested=resolve;});
  const pending=new Promise(resolve=>{release=resolve;});
  await page.route('**/api/coach',async r=>{requested();await pending;await r.fulfill({json:{explanation:'STALE_TEST_RESPONSE',mode:'llm'}});});
  await page.reload();await act(page,'start');
  await page.locator('[data-choice="0"]').click();await act(page,'submit');await act(page,'ai');await started;
  await nav(page,'review');await page.locator('[data-qid="g1"]').click();
  await page.locator('[data-choice="1"]').click();await act(page,'submit');
  const response=page.waitForResponse('**/api/coach');release();await response;
  assert.ok(!(await text(page)).includes('STALE_TEST_RESPONSE'));
});

test('real HTTP denies private paths, foreign Host/Origin and supports HEAD',async()=>{
  assert.equal((await fetch(`${base}/.env`)).status,403);
  assert.equal((await fetch(`${base}/.git/config`)).status,403);
  assert.equal((await fetch(`${base}/src%5c..%5c.env`)).status,403);
  const foreignHost=await new Promise((resolve,reject)=>{const req=http.get(base,{headers:{host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});
  assert.equal(foreignHost,403);
  assert.equal((await fetch(`${base}/api/coach`,{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{}'})).status,403);
  const head=await fetch(base,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
});

test('built static site works under a repository subpath without any private API',async t=>{
  const staticServer=http.createServer(async(req,res)=>{
    if(!req.url.startsWith('/portfolio/')){res.writeHead(404);res.end();return;}
    let name=req.url.slice('/portfolio/'.length).split('?')[0]||'index.html';
    if(!/^[\w./-]+$/.test(name)||name.includes('..')||name.startsWith('api/')){res.writeHead(404);res.end();return;}
    try{const data=await readFile(path.resolve('dist',name));const ext=path.extname(name);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.md':'text/plain'})[ext]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>staticServer.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>staticServer.close(resolve)));
  const context=await browser.newContext();t.after(()=>context.close());
  const page=await context.newPage(), errors=[], external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')external.push(r.url());});
  const site=`http://127.0.0.1:${staticServer.address().port}/portfolio/`;
  await page.goto(site);await act(page,'seed');await act(page,'start');
  await page.locator('[data-choice="1"]').click();await act(page,'submit');
  assert.equal(await count(page),9);
  await page.reload();assert.equal(new URL(page.url()).hash,'#practice');
  await nav(page,'review');await page.reload();assert.match(await text(page),/复习计划/);
  await nav(page,'product');await page.reload();assert.match(await text(page),/产品方案与决策/);
  assert.equal((await fetch(`${site}api/coach`)).status,404);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  const critical=['index.html','styles.css','src/app.js','src/engine.js','src/storage.js','src/questions.js'];
  const bytes=(await Promise.all(critical.map(f=>readFile(path.join('dist',f))))).reduce((sum,data)=>sum+data.length,0);
  assert.ok(bytes<100*1024,`${bytes} bytes critical source`);
  await mkdir('test-results',{recursive:true});
  await writeFile('test-results/performance.json',JSON.stringify({capturedAt:new Date().toISOString(),browser:await browser.version(),criticalSourceBytes:bytes,externalRequests:external.length,note:'Local unthrottled smoke check; not a Lighthouse score or production load test'},null,2));
});

test('standalone file:// preview supports demo, answer, review and reset offline',async t=>{
  const context=await browser.newContext();t.after(()=>context.close());
  const page=await context.newPage(), external=[], errors=[];
  page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve('preview.html')).href);
  await act(page,'seed');await act(page,'start');await page.locator('[data-choice="1"]').click();await act(page,'submit');
  assert.match(await text(page),/回答正确/);
  assert.equal(await page.locator('[data-action="ai"]').isDisabled(),true);
  await nav(page,'review');assert.match(await text(page),/复习计划/);
  page.once('dialog',d=>d.accept());await page.locator('#reset-button').click();
  assert.match(await text(page),/尚无作答数据/);
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
});
