import { QUESTIONS, TOPICS } from './questions.js';

// The recommendation engine is a transparent deterministic baseline, NOT an LLM.
export function topicStats(history = [], questions = QUESTIONS, topics = TOPICS) {
  return topics.map(topic => {
    const qs = questions.filter(q => q.topic === topic.id);
    const records = history.filter(h => qs.some(q => q.id === h.questionId)).sort((a,b) => a.at - b.at);
    const firstAttempts = new Map();
    for (const r of records) if (!firstAttempts.has(r.questionId)) firstAttempts.set(r.questionId, r);
    const firstCorrect = [...firstAttempts.values()].filter(a => a.correct).length;
    const covered = firstAttempts.size;
    const wrong = [...firstAttempts.values()].filter(a => !a.correct).length;
    const accuracy = covered ? firstCorrect / covered : null;
    return {
      ...topic, total: qs.length, covered, attempts: records.length, firstCorrect,
      firstAccuracy: accuracy, wrong, coverage: qs.length ? covered / qs.length : 0,
      mastery: qs.length ? Math.round((firstCorrect / qs.length) * 100) : 0
    };
  });
}

export function summaryStats(history = [], questions = QUESTIONS) {
  const first = new Map();
  const records = history.filter(h => questions.some(q => q.id === h.questionId));
  for (const h of [...records].sort((a,b) => a.at - b.at)) {
    if (!first.has(h.questionId)) first.set(h.questionId, h);
  }
  const firstRecords = [...first.values()];
  return {
    attempts: records.length,
    covered: firstRecords.length,
    total: questions.length,
    firstCorrect: firstRecords.filter(h => h.correct).length,
    firstAccuracy: firstRecords.length ? Math.round(100 * firstRecords.filter(h => h.correct).length / firstRecords.length) : null,
    wrongQuestions: firstRecords.filter(h => !h.correct).length
  };
}

export function latestForQuestion(history, questionId) {
  // Equal millisecond timestamps still preserve the most recently appended answer.
  return history.reduce((latest, h) => h.questionId === questionId && (!latest || h.at >= latest.at) ? h : latest, null);
}

export function reviewQueue(history = [], now = Date.now(), questions = QUESTIONS) {
  const records = questions.map(q => ({ question: q, latest: latestForQuestion(history, q.id) })).filter(x => x.latest);
  return records.filter(({latest}) => {
    const age = now - latest.at;
    const interval = latest.correct ? 3*86400000 : 86400000;
    return age >= interval;
  }).sort((a,b) => a.latest.at - b.latest.at);
}

export function weakestTopic(history = [], questions = QUESTIONS, topics = TOPICS) {
  const stats = topicStats(history, questions, topics);
  const available = stats.filter(s => s.total > 0);
  const withUnseen = available.filter(s => s.covered < s.total);
  return [...(withUnseen.length ? withUnseen : available)].sort((a,b) => topicPriority(b, history, questions) - topicPriority(a, history, questions))[0];
}

function topicPriority(topic, history, questions) {
  const unresolved = questions.filter(q => q.topic === topic.id && latestForQuestion(history, q.id)?.correct === false).length;
  return unresolved * 4 + (1 - topic.coverage) * 2;
}

// The same decision object powers the dashboard, practice card and test assertions.
export function recommendation(history = [], { topicId = null, mode = 'adaptive', now = Date.now(), questions = QUESTIONS } = {}) {
  const candidates = questions.filter(q => !topicId || q.topic === topicId);
  const due = reviewQueue(history, now, candidates);
  const wrong = candidates.filter(q => latestForQuestion(history, q.id)?.correct === false)
    .sort((a,b) => latestForQuestion(history,a.id).at - latestForQuestion(history,b.id).at);
  const decision = (question, kind, reason) => ({ question, kind, reason, topicId: question?.topic || null });
  if (mode === 'review') {
    if (due.length) return decision(due[0].question, 'due', '本题已到复习时间：最近答错间隔 1 天，答对间隔 3 天。');
    if (wrong.length) return decision(wrong[0], 'wrong', '本题最近一次作答错误，尚未到期，也可以立即巩固。');
    return decision(null, 'complete', '本轮复习完成：没有到期题或最近答错的题。');
  }
  const unseen = candidates.filter(q => !history.some(h => h.questionId === q.id));
  if (unseen.length) {
    const topic = weakestTopic(history, candidates)?.id;
    const q = unseen.filter(q => q.topic === topic).sort((a,b) => a.difficulty - b.difficulty)[0] || unseen[0];
    const stats = topicStats(history, questions).find(t => t.id === q.topic);
    const unresolved = wrong.filter(w => w.topic === q.topic).length;
    return decision(q, 'unseen', `「${stats?.label || q.topic}」已首答 ${stats?.covered || 0}/${stats?.total || 0} 题，最近仍答错 ${unresolved} 题。本题尚未作答；优先有错题且有新题的知识点，再按覆盖缺口和难度排序。`);
  }
  if (wrong.length) return decision(wrong[0], 'wrong', '所选范围内已无新题，优先复练最近仍答错且最久未练的一题。');
  if (due.length) return decision(due[0].question, 'due', '所选范围内已无新题或未纠正错题，复测一题已到期的题。');
  return decision(null, 'complete', '所选题目已覆盖，且没有待纠正或到期题。样例作答不代表已掌握知识点。');
}

export function pickQuestion(history = [], options = {}) {
  return recommendation(history, options).question;
}

export function suggestedAction(history = [], questions = QUESTIONS) {
  const result = recommendation(history, { questions });
  const topic = TOPICS.find(t => t.id === result.topicId);
  return { ...result, title: !result.question ? '本轮练习完成' : !history.length ? '从一道题开始诊断' : `下一题：${topic?.label || '针对性练习'}`, description: result.reason };
}

export function seededDemoHistory(now = Date.now()) {
  const d = n => now - n * 86400000;
  return [
    {questionId:'g1', topic:'growth', correct:true, selected:1, at:d(5)},
    {questionId:'g2', topic:'growth', correct:false, selected:1, at:d(4)},
    {questionId:'b1', topic:'base', correct:false, selected:0, at:d(3)},
    {questionId:'l1', topic:'logic', correct:true, selected:1, at:d(3)},
    {questionId:'s1', topic:'sets', correct:false, selected:3, at:d(2)},
    {questionId:'g3', topic:'growth', correct:true, selected:2, at:d(2)},
    {questionId:'b2', topic:'base', correct:true, selected:1, at:d(1)},
    {questionId:'g2', topic:'growth', correct:true, selected:2, at:d(0.4)}
  ];
}
