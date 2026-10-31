import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS } from '../src/questions.js';
import { pickQuestion, recommendation, summaryStats, latestForQuestion, reviewQueue, seededDemoHistory } from '../src/engine.js';
import { normalizeSaved, readSaved } from '../src/storage.js';
import { publicPath } from '../scripts/dev-server.mjs';

const now = 1_790_000_000_000, day = 86400000;
const answer = (q, correct = true, at = now) => ({ questionId:q.id, topic:q.topic, selected:correct ? q.answer : (q.answer+1)%4, correct, at });

test('fully covered weak topic cannot starve unseen topics', () => {
  const h = QUESTIONS.filter(q => q.topic === 'growth').map(q => answer(q, false));
  assert.notEqual(pickQuestion(h, {now}).topic, 'growth');
});
test('corrected historical mistakes no longer outrank unresolved errors', () => {
  const g = QUESTIONS[0], b = QUESTIONS[3];
  const h = [answer(g,false,now-2),answer(g,true,now-1),answer(b,false,now)];
  assert.equal(pickQuestion(h,{now}).topic,'base');
  assert.equal(summaryStats(h).firstCorrect,0);
});
test('same timestamp uses latest appended result for review', () => {
  const q = QUESTIONS[0], h = [answer(q,false),answer(q,true)];
  assert.equal(latestForQuestion(h,q.id).correct,true);
  assert.equal(summaryStats(h).firstAccuracy,0);
});
test('review completion never falls through to unseen practice', () => {
  assert.equal(pickQuestion([],{mode:'review',now}),null);
  assert.equal(pickQuestion([answer(QUESTIONS[0])],{mode:'review',now}),null);
});
test('full coverage gives completion instead of repeating forever', () => {
  assert.equal(pickQuestion(QUESTIONS.map(q => answer(q)),{now}),null);
});
test('explicit topic filter is respected including empty and invalid topic', () => {
  assert.equal(pickQuestion([],{topicId:'logic',now}).id,'l1');
  assert.equal(pickQuestion([],{topicId:'unknown',now}),null);
});
test('review boundary uses last answer: 1 day wrong, 3 days correct', () => {
  const q=QUESTIONS[0];
  assert.equal(reviewQueue([answer(q,false,now-day+1)],now).length,0);
  assert.equal(reviewQueue([answer(q,false,now-day)],now).length,1);
  assert.equal(reviewQueue([answer(q,true,now-3*day)],now).length,1);
  assert.equal(reviewQueue([answer(q,false,now-4*day),answer(q,true,now-1)],now).length,0);
});
test('recommendation explanation and actual chosen question use one decision', () => {
  const h=seededDemoHistory(now), r=recommendation(h,{now});
  assert.equal(r.question.id,pickQuestion(h,{now}).id);
  assert.ok(r.reason.includes('尚未作答'));
  assert.equal(r.topicId,r.question.topic);
});
test('stored payload derives trusted topic and correctness from the bank', () => {
  const value={history:[{...answer(QUESTIONS[0]),topic:'<img onerror=alert(1)>',correct:false,errorReason:'concept',helpful:'yes',prompt:'secret'}],demo:true};
  const {history,demo}=normalizeSaved(value,now);
  assert.equal(history[0].correct,true);
  assert.equal(history[0].topic,'growth');
  assert.equal(history[0].errorReason,'concept');
  assert.equal(history[0].helpful,'yes');
  assert.equal(history[0].prompt,undefined);
  assert.equal(demo,true);
});
test('null, malformed and unknown stored records cannot corrupt statistics', () => {
  for (const value of [null,[],42,'text']) assert.deepEqual(normalizeSaved(value,now),{history:[],demo:false});
  const q=answer(QUESTIONS[0]);
  const invalid=[null,{...q,questionId:'missing'},{...q,selected:99},{...q,at:-1},{...q,at:now+day},{...q,at:Infinity}];
  assert.equal(normalizeSaved({history:invalid},now).history.length,0);
  assert.equal(readSaved({getItem:()=>'{broken'}).history.length,0);
  assert.match(readSaved({getItem:()=>{throw Error('blocked');}}).warning,/不可用/);
});
test('server allowlist blocks Windows paths, hidden files, secrets and traversal', () => {
  for (const url of ['/.env','/.env.local','/.git/config','/api/coach.mjs','/package.json','/node_modules/a.js','/%2e%2e/src/app.js','/src%5c..%5c.env','/C:/secret','/%00','/%ZZ']) assert.equal(publicPath(url),null,url);
  assert.equal(publicPath('/'),'index.html');
  assert.equal(publicPath('/src/app.js?cache=1'),'src/app.js');
  assert.equal(publicPath('/assets/demo-dashboard.png'),'assets/demo-dashboard.png');
});
