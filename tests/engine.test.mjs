import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, TOPICS } from '../src/questions.js';
import { summaryStats, topicStats, reviewQueue, pickQuestion, weakestTopic, seededDemoHistory } from '../src/engine.js';

test('original question bank has distinct IDs and valid answer indices',()=>{
  assert.equal(QUESTIONS.length,12);
  assert.equal(new Set(QUESTIONS.map(q=>q.id)).size,QUESTIONS.length);
  QUESTIONS.forEach(q=>{
    assert.ok(TOPICS.some(t=>t.id===q.topic));
    assert.equal(q.options.length,4);
    assert.ok(q.answer>=0&&q.answer<4);
    assert.ok(q.analysis.length>=2);
  });
});
test('first-attempt accuracy excludes repeated correct answers',()=>{
  const history=[
    {questionId:'g1',topic:'growth',correct:false,at:1},
    {questionId:'g1',topic:'growth',correct:true,at:2},
    {questionId:'b1',topic:'base',correct:true,at:3}
  ];
  assert.deepEqual(summaryStats(history),{attempts:3,covered:2,total:12,firstCorrect:1,firstAccuracy:50,wrongQuestions:1});
  const growth=topicStats(history).find(t=>t.id==='growth');
  assert.equal(growth.firstAccuracy,0);
  assert.equal(growth.covered,1);
});
test('empty records do not invent accuracy',()=>{
  assert.equal(summaryStats([]).firstAccuracy,null);
  assert.equal(topicStats([])[0].firstAccuracy,null);
});
test('review queue follows time windows, with wrong answers due in one day',()=>{
  const day=86400000, now=10*day;
  const history=[
    {questionId:'g1',topic:'growth',correct:false,at:now-2*day},
    {questionId:'g2',topic:'growth',correct:true,at:now-2*day},
    {questionId:'g3',topic:'growth',correct:true,at:now-4*day}
  ];
  assert.deepEqual(reviewQueue(history,now).map(r=>r.question.id),['g3','g1']);
});
test('recommendation prefers a demonstrated weak topic and unseen question',()=>{
  const h=[{questionId:'b1',topic:'base',correct:false,at:1}];
  assert.equal(weakestTopic(h).id,'base');
  assert.equal(pickQuestion(h).id,'b2');
});
test('demo records are explicitly generated and include a corrected answer',()=>{
  const records=seededDemoHistory();
  assert.equal(records.length,8);
  assert.equal(records.filter(x=>x.questionId==='g2').length,2);
});
