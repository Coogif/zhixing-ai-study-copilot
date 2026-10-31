import { QUESTIONS, TOPICS, getTopic, getQuestion } from './questions.js';
import { topicStats, summaryStats, latestForQuestion, reviewQueue, recommendation, suggestedAction, seededDemoHistory } from './engine.js';
import { STORAGE_KEY, ERROR_REASONS, readSaved } from './storage.js';

const saved = readSaved({ getItem: key => localStorage.getItem(key) });
const state = { view:'dashboard', topic:'all', history:saved.history, demo:saved.demo, questionId:null, selected:null, answered:false, practiceMode:'adaptive', aiResponse:'', aiLoading:false, generation:0, recommendation:null, attempt:null, aiAvailable:false, storageWarning:saved.warning };
const app = document.querySelector('#app');
const save = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({history:state.history, demo:state.demo})); }
  catch { state.storageWarning='本次记录尚未持久保存：刷新可能丢失，请检查浏览器存储设置。'; toast(state.storageWarning); }
};
const pct = v => v == null ? '—' : `${Math.round(v * 100)}%`;
const numPct = v => v == null ? '—' : `${v}%`;
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastTimer;
function toast(s) { const el=document.querySelector('#toast'); el.textContent=s; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2600); }
function navigate(view, topic) {
  state.view=view;
  if (topic) state.topic=topic;
  if (view==='practice') { state.selected=null;state.answered=false; state.practiceMode='adaptive';setQuestion(); }
  window.location.hash=view;
  render();
  window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
function setQuestion({ mode=state.practiceMode, questionId=null }={}) {
  state.generation++;
  state.recommendation = questionId ? {question:getQuestion(questionId),reason:'你从复习清单选择了本题。先独立复测，再与首答比较。'} : recommendation(state.history,{topicId:state.topic==='all'?null:state.topic,mode});
  const q = state.recommendation.question;
  state.questionId=q?.id||null;
  state.selected=null;
  state.answered=false;
  state.aiResponse='';
  state.aiLoading=false;
  state.attempt=null;
}
function showDashboard() {
  const stats=summaryStats(state.history), topics=topicStats(state.history), next=suggestedAction(state.history);
  const due=reviewQueue(state.history).length;
  const history=[...state.history].sort((a,b)=>b.at-a.at).slice(0,4);
  return `<div class="page-header"><div><div class="eyebrow">YOUR LEARNING SPACE</div><h1>今天，也向前一步 <span style="color:#b0b3c7;font-size:20px">✳</span></h1><p>不靠感觉判断掌握情况，用每一次真实作答找到下一步。</p></div><button class="btn btn-neutral" data-action="seed">${state.demo?'↻ 重新加载示例':'✦ 加载演示数据'}</button></div>
    <section class="hero"><div class="hero-content"><div class="hero-tag">✧ PERSONALIZED LEARNING PATH</div><h2>比起做更多题，先做对下一题。</h2><p>围绕薄弱知识点持续练习，让知识诊断、练习和复盘形成闭环。</p><button class="btn" data-action="start">开始智能练习 <span>↗</span></button></div><div class="hero-art" aria-hidden="true"><div class="art-card"><span></span><span></span><span></span></div><div class="art-card second"><span></span><span class="art-line"></span><span></span></div><span class="sparkle">✦</span></div></section>
    <div class="stats-grid"><div class="stat-card"><div class="stat-top"><span class="stat-label">累计作答</span><span class="stat-icon">▤</span></div><div class="stat-value">${stats.attempts}<small>题次</small></div><div class="stat-foot">包括重复练习</div></div>
    <div class="stat-card"><div class="stat-top"><span class="stat-label">首次正确率</span><span class="stat-icon">◎</span></div><div class="stat-value">${numPct(stats.firstAccuracy)}</div><div class="stat-foot">${stats.covered ? `${stats.firstCorrect} / ${stats.covered} 道独立首答`:'尚无作答数据'}</div></div>
    <div class="stat-card"><div class="stat-top"><span class="stat-label">已覆盖题目</span><span class="stat-icon">▥</span></div><div class="stat-value">${stats.covered}<small> / ${stats.total}</small></div><div class="stat-foot">基于示例题库的覆盖率</div></div>
    <div class="stat-card"><div class="stat-top"><span class="stat-label">待复习题目</span><span class="stat-icon">↻</span></div><div class="stat-value">${due}<small>道</small></div><div class="stat-foot">按简易复习间隔生成</div></div></div>
    <div class="section-grid"><section class="panel"><div class="panel-head"><h3>知识点首答表现</h3><span>首答正确率与题库覆盖分开显示</span></div>${topics.map(t=>{const unresolved=QUESTIONS.filter(q=>q.topic===t.id&&latestForQuestion(state.history,q.id)?.correct===false).length;return `<div class="topic-row"><div class="topic-first"><span class="topic-left"><span class="topic-glyph ${t.color}">${t.icon}</span>${t.label}</span><span class="topic-right"><strong>${t.covered?pct(t.firstAccuracy):'暂无数据'}</strong></span></div><p class="topic-evidence">首答正确 ${t.firstCorrect}/${t.covered} · 已覆盖 ${t.covered}/${t.total} · 待纠正 ${unresolved} 题</p><div class="progress-track" role="progressbar" aria-label="${t.label}题库覆盖" aria-valuenow="${t.covered}" aria-valuemin="0" aria-valuemax="${t.total}"><div class="progress-fill ${t.color}" style="width:${t.coverage*100}%"></div></div></div>`}).join('')}<p class="disclaimer">进度条仅表示题库覆盖。每个知识点只有 3 道示例题，不能推断真实能力。</p></section>
    <section class="panel"><div class="panel-head"><h3>✦ 下一步建议</h3><span>规则推荐</span></div><div class="insight-card"><div class="insight-title"><span>✧</span> 作答证据 → 下一题</div><h4>${escapeHtml(next.title)}</h4><p>${escapeHtml(next.description)}</p>${next.question?`<p class="next-question">推荐题：${escapeHtml(next.question.title)}</p>`:''}</div><button class="small-btn" data-action="start" ${next.question?'':'disabled'}>去做针对性练习　→</button><p class="disclaimer" style="margin-bottom:0">先覆盖新题，再纠错和到期复测。纠正后不再计入待纠正数，首答历史保留。推荐无需大模型。</p></section></div>
    <div class="section-grid"><section class="panel"><div class="panel-head"><h3>最近学习动态</h3><span>${state.demo?'当前为虚构演示记录':'你的本地作答记录'}</span></div>${history.length?`<div class="mini-list">${history.map(h=>{const q=getQuestion(h.questionId);return `<div class="mini-list-item"><div class="mini-dot">${h.correct?'✓':'×'}</div><div><strong>${escapeHtml(q?.title||h.questionId)}</strong><span>${new Date(h.at).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'})} · ${escapeHtml(getTopic(h.topic)?.group||'练习')}</span></div><div class="mini-status ${h.correct?'good':'bad'}">${h.correct?'回答正确':'需要复盘'}</div></div>`}).join('')}</div>`:'<div class="empty"><div class="empty-icon">◌</div><strong>还没有学习记录</strong>先开始一题，或加载虚构演示数据查看完整产品体验。</div>'}</section>
    <section class="panel"><div class="panel-head"><h3>产品设计原则</h3><a href="#product" data-view="product">了解产品思路 ↗</a></div><div class="mini-list"><div class="mini-list-item"><div class="mini-dot">①</div><div><strong>先诊断，再推荐</strong><span>基于首次作答，降低盲目刷题</span></div></div><div class="mini-list-item"><div class="mini-dot">②</div><div><strong>解释为什么推荐</strong><span>每条建议提供数据依据</span></div></div><div class="mini-list-item"><div class="mini-dot">③</div><div><strong>区分事实与模型能力</strong><span>离线规则与在线 AI 讲解明确标注</span></div></div></div></section></div>`;
}
function showPractice() {
  let q=getQuestion(state.questionId);
  if (!q) return `<div class="empty"><h1>${state.practiceMode==='review'?'本轮复习完成':'本轮练习完成'}</h1><p>${escapeHtml(state.recommendation?.reason || '目前没有待练题目。')}</p><button class="btn btn-primary" data-view="dashboard">返回学习总览</button> <button class="btn btn-neutral" data-action="start">查看全部知识点</button></div>`;
  const topic=getTopic(q.topic), isCorrect=state.selected===q.answer;
  return `<div class="page-header"><div><div class="eyebrow">PRACTICE & FEEDBACK</div><h1>智能练习</h1><p>先独立作答，再看步骤解析；针对薄弱点推荐下一题。${state.demo?' 当前已加载虚构演示数据，请勿当作真实学习记录。':''}</p></div><span class="demo-pill">12 道原创示例题</span></div>
    <div class="picker"><button class="chip ${state.topic==='all'?'active':''}" data-action="topic" data-topic="all">✦ 自适应推荐</button>${TOPICS.map(t=>`<button class="chip ${state.topic===t.id?'active':''}" data-action="topic" data-topic="${t.id}">${t.label}</button>`).join('')}</div>
    <div class="recommendation-note"><strong>${state.practiceMode==='review'?'错题与到期复测':'为什么推荐这题 · 规则版'}</strong><p>${escapeHtml(state.recommendation?.reason || '')}</p>${state.topic!=='all'?'<span>当前已手动限定知识点；切换“自适应推荐”可跨知识点选题。</span>':''}</div>
    <div class="practice-layout"><section class="panel question-card"><div class="question-top"><span class="q-tag">${escapeHtml(topic.group)} · ${escapeHtml(topic.label)}</span><span class="q-difficulty">难度 ${'●'.repeat(q.difficulty)}${'○'.repeat(3-q.difficulty)}</span></div><div class="q-index">QUESTION · ${String(QUESTIONS.indexOf(q)+1).padStart(2,'0')} / ${QUESTIONS.length}</div><h2>${escapeHtml(q.title)}</h2><div class="question-stem">${escapeHtml(q.stem)}</div><div class="options" role="group" aria-label="作答选项">${q.options.map((o,i)=>`<button class="option ${state.selected===i?'selected':''} ${state.answered&&q.answer===i?'correct':''} ${state.answered&&state.selected===i&&!isCorrect?'incorrect':''}" data-action="choose" data-choice="${i}" aria-pressed="${state.selected===i}" ${state.answered?'disabled':''}><span class="option-letter">${'ABCD'[i]}</span><span>${escapeHtml(o)}${state.answered&&q.answer===i?'（正确答案）':''}${state.answered&&state.selected===i?'（你的选择）':''}</span></button>`).join('')}</div>
    ${state.answered?`<div class="answer-result ${isCorrect?'good':'bad'}" tabindex="-1"><strong>${isCorrect?'✓ 回答正确，继续巩固':'✕ 这题没答对，先看看解题步骤'}</strong><p>预写解析 · AI 辅助整理，尚未经独立教育专家审核。</p><ol>${q.analysis.map(p=>`<li>${escapeHtml(p)}</li>`).join('')}</ol><div class="trap">易错提醒：${escapeHtml(q.trap)}</div></div><div class="feedback-box">${!isCorrect?`<p><strong>这次主要卡在哪里？</strong> 可选自评，不是 AI 判断</p><div class="feedback-options">${Object.entries(ERROR_REASONS).map(([id,label])=>`<button class="chip" data-action="error-reason" data-value="${id}" aria-pressed="${state.attempt?.errorReason===id}">${label}</button>`).join('')}</div>${state.attempt?.errorReason?`<p role="status">已记录：${ERROR_REASONS[state.attempt.errorReason]}。${state.attempt.errorReason==='concept'?'回看知识点公式，再用新题验证。':state.attempt.errorReason==='method'?'先识别题型，再选择方法。':state.attempt.errorReason==='careless'?'列出条件与单位，提交前检查计算。':'结合解析回顾过程，不必急于下结论。'}</p>`:''}`:''}<p>这份预写解析有帮助吗？</p><button class="chip" data-action="helpful" data-value="yes" aria-pressed="${state.attempt?.helpful==='yes'}">有帮助</button> <button class="chip" data-action="helpful" data-value="no" aria-pressed="${state.attempt?.helpful==='no'}">仍不清楚</button>${state.attempt?.helpful?'<p role="status">反馈已记录在本机，用于你回顾解析体验；没有上传或训练模型。</p>':''}</div>`:''}
    <div class="question-actions"><span class="question-aside-foot">${state.answered?'答案已计入本地学习记录':'独立作答 · 无计时压力'}</span>${state.answered?'<button class="btn btn-primary" data-action="next">下一题　→</button>':`<button class="btn btn-primary" data-action="submit" ${state.selected==null?'disabled':''}>提交答案　→</button>`}</div></section>
    <aside><div class="panel aside-card"><div class="panel-head" style="margin-bottom:15px"><h3>知识点反馈</h3></div><span class="concept-pill">${escapeHtml(topic.label)}</span>${state.answered?`<div class="method-box"><strong>迁移到下一题的方法</strong><p>${escapeHtml(topic.method)}</p></div>`:'<p class="question-aside-foot">先独立完成本题。提交后解锁方法卡片和易错提醒，避免提示影响首答。</p>'}<p class="question-aside-foot">${state.answered?`下次复习：${new Date(state.attempt.at+(isCorrect?3:1)*86400000).toLocaleString('zh-CN')}。固定间隔仅为演示，答对一次不代表掌握。`:'首答正确率只计算每题第一次提交。复测会更新当前错题状态，同时保留首答证据。'}</p></div>
    <div class="panel aside-card" style="margin-top:17px"><h3>✦ AI 延伸讲解（可选）</h3><p class="question-aside-foot">${state.aiAvailable?'本地模型接口已配置。点击后会向 OpenAI 发送本题、你的选项及预写解析，不发送学习历史或自评反馈。模型可能出错，请核对原解析。':'当前未启用模型讲解；公开静态版和离线版只提供预写解析。核心练习不需要 API Key。'}</p><button class="btn explain-btn" data-action="ai" ${!state.answered||state.aiLoading||!state.aiAvailable?'disabled':''}>${state.aiLoading?'正在请求…':state.aiAvailable?'请求 AI 讲解　↗':'模型讲解未启用'}</button>${state.aiResponse?`<div class="explain-output">${escapeHtml(state.aiResponse)}</div>`:''}</div></aside></div>`;
}
function showReview() {
  const due=reviewQueue(state.history);
  const dueIds=new Set(due.map(x=>x.question.id));
  const wrong=QUESTIONS.filter(q=>latestForQuestion(state.history,q.id)?.correct===false&&!dueIds.has(q.id));
  const upcoming=QUESTIONS.filter(q=>latestForQuestion(state.history,q.id)?.correct===true&&!dueIds.has(q.id));
  const firstWrong=QUESTIONS.filter(q=>state.history.find(h=>h.questionId===q.id)?.correct===false);
  const corrected=firstWrong.filter(q=>latestForQuestion(state.history,q.id)?.correct===true).length;
  return `<div class="page-header"><div><div class="eyebrow">REVIEW & RETENTION</div><h1>复习计划</h1><p>最近答错间隔 1 天、答对间隔 3 天。每次提交都会重排时间，固定间隔仅供演示。</p></div><button class="btn btn-secondary" data-action="review-start" ${!due.length&&!wrong.length?'disabled':''}>开始复习　↗</button></div>
    <div class="recommendation-note"><strong>首答错题 ${firstWrong.length} 道 · 最近已答对 ${corrected} 道</strong><p>这里只是同题纠正记录，可能受记忆影响，不能解读为提分效果。到期题、未到期错题和后续复习分开列出，每题只出现一次。</p></div>
    <section class="panel review-section"><div class="panel-head"><h3>已到期 · ${due.length} 题</h3><span>优先复习</span></div>
    ${due.length?due.map(x=>reviewItem(x.question,'计划到期')).join('') : '<div class="empty"><strong>目前没有到期复习题目</strong>答题记录会自动形成后续计划。</div>'}
    ${wrong.length?`<div class="panel-head" style="margin-top:30px"><h3>待纠正 · ${wrong.length} 题</h3><span>尚未到期，可立即巩固</span></div>${wrong.map(q=>reviewItem(q,'最近答错')).join('')}`:''}
    ${upcoming.length?`<div class="panel-head" style="margin-top:30px"><h3>后续复习 · ${upcoming.length} 题</h3><span>最近已答对</span></div>${upcoming.map(q=>reviewItem(q,'等待到期',false)).join('')}`:''}</section>`;
}
function reviewItem(q,badge,actionable=true) {
  const latest=latestForQuestion(state.history,q.id);
  const reason=latest?.errorReason?` · 自评：${ERROR_REASONS[latest.errorReason]}`:'';
  const date=new Date(latest.at+(latest.correct?3:1)*86400000).toLocaleString('zh-CN');
  return `<div class="review-item" data-review-id="${q.id}"><div class="topic-glyph ${getTopic(q.topic)?.color}">${getTopic(q.topic)?.icon}</div><div class="review-name"><strong>${escapeHtml(q.title)}</strong><span>${escapeHtml(getTopic(q.topic)?.group)} · ${latest.correct?'最近答对':'最近答错'}${reason}</span><span>下次复习：${date}</span></div><div class="review-badge">${badge}</div>${actionable?`<button class="btn btn-neutral" data-action="review-q" data-qid="${q.id}" aria-label="复测${escapeHtml(q.title)}">复测 →</button>`:''}</div>`;
}
function showProduct() {
  return `<div class="page-header"><div><div class="eyebrow">BEHIND THE PRODUCT</div><h1>产品方案与决策</h1><p>这个页面不是宣传文案，而是把用户需求、MVP 边界与衡量指标公开呈现。</p></div><a href="docs/PRD.md" target="_blank" class="btn btn-neutral">查看完整 PRD ↗</a></div>
    <div class="panel" style="margin-bottom:20px"><div class="panel-head"><h3>问题定义 · Problem Statement</h3><span>产品经理视角</span></div><div class="callout"><strong>看完课程 ≠ 真正掌握。</strong> 学习者可能记得概念，却在实际做题时遇到题型识别不准、错误反复出现的问题。传统刷题工具往往能够记录对错，但没有清晰告诉用户“为什么优先练这个”。</div><div class="prd-flow" style="margin-top:25px"><span class="flow-step">独立作答</span><span class="flow-arrow">→</span><span class="flow-step">记录首答</span><span class="flow-arrow">→</span><span class="flow-step">薄弱点排序</span><span class="flow-arrow">→</span><span class="flow-step">针对性练习</span><span class="flow-arrow">→</span><span class="flow-step">间隔复测</span></div></div>
    <div class="detail-list" style="margin-bottom:20px"><div class="detail-tile"><div class="detail-num">01</div><h3>确定目标用户与核心场景</h3><p>目标用户是假设：已学过理论但迁移不稳的自学者。初始问题来自个人学习观察，尚未访谈验证。</p></div><div class="detail-tile"><div class="detail-num">02</div><h3>用可解释规则建立基线</h3><p>保留首答证据，用当前未纠正错题数与覆盖缺口排序。规则未经教育效果验证，不作能力评分。</p></div><div class="detail-tile"><div class="detail-num">03</div><h3>先验证 AI 的增量价值</h3><p>模型可能帮助重述难懂的解析，但尚未做真实质量评测。保留可选本地接口，公开版使用预写解析。</p></div><div class="detail-tile"><div class="detail-num">04</div><h3>定义可验证的成功指标</h3><p>下一轮计划5人任务测试，再考虑推荐转化与延迟复测；没有真实增长或提分数据。</p></div></div>
    <div class="product-columns"><section class="panel"><div class="panel-head"><h3>成功指标设计</h3></div><table class="metric-table"><tr><th>指标</th><th>定义</th></tr><tr><td>首次作答正确率</td><td>首答正确题数 / 独立首答总数</td></tr><tr><td>知识点覆盖率</td><td>首次作答题数 / 该知识点题库数</td></tr><tr><td>错题复测改进率</td><td>复测正确的错题 / 已复测错题</td></tr><tr><td>推荐接受率</td><td>点击并开始推荐练习次数 / 推荐曝光</td></tr></table><p class="disclaimer">目前只实现部分基础测量；其余是后续埋点计划，没有虚构的业务增长数据。</p></section><section class="panel"><div class="panel-head"><h3>MVP 边界说明</h3></div><p class="disclaimer"><strong>已实现：</strong>原创示例题、自主作答、首答记录、知识点统计、可解释的规则推荐、简化间隔复习、本地数据存储、可选模型讲解接口。</p><p class="disclaimer"><strong>未实现：</strong>真实题库接入、用户登录、多设备同步、知识追踪模型、经实验证实的提分效果、上线用户增长。</p><a class="inline-link" href="docs/METRICS.md" target="_blank">查看指标与实验假设 ↗</a></section></div>`;
}
function render() {
  document.querySelectorAll('.nav-item').forEach(el=>{el.classList.toggle('active',el.dataset.view===state.view); if(el.dataset.view===state.view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  const labels={dashboard:'学习总览',practice:'智能练习',review:'复习计划',product:'产品方案'};
  document.querySelector('#current-page-title').textContent=labels[state.view]||labels.dashboard;
  app.innerHTML=`${state.demo?'<div class="data-notice" role="status">虚构演示数据模式 · 本轮新增作答也仅用于体验。开始个人练习前请重置数据。</div>':''}${state.storageWarning?`<div class="data-notice warning" role="alert">${escapeHtml(state.storageWarning)}</div>`:''}`+({dashboard:showDashboard,practice:showPractice,review:showReview,product:showProduct}[state.view]||showDashboard)();
  const count=reviewQueue(state.history).length;
  document.querySelector('#review-count').textContent=count;
  document.querySelector('#review-count').classList.toggle('show',count>0);
}
async function requestAI() {
  const q=getQuestion(state.questionId);if (!q||!state.answered||state.aiLoading)return;
  if (!state.aiAvailable) {
    state.aiResponse='当前环境未启用模型讲解。静态演示使用预写解析；本地配置方法见 README。';
    render(); return;
  }
  const selected=state.selected;
  const generation=state.generation;
  state.aiLoading=true;state.aiResponse='正在请求模型讲解…';render();
  try {
    const response=await fetch('/api/coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questionId:q.id,selected})});
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||'模型接口不可用');
    if (state.generation !== generation || state.questionId !== q.id || !state.answered) return;
    state.aiResponse=data.explanation||'模型没有返回内容';
  } catch(e) {if (state.generation === generation && state.questionId === q.id && state.answered) state.aiResponse=`AI 讲解暂不可用：${e.message}。请使用预写解析。`;}
  if (state.generation === generation && state.questionId === q.id && state.answered) {state.aiLoading=false;render();}
}
document.addEventListener('click',ev=>{
  const nav=ev.target.closest('[data-view]');
  if(nav) {ev.preventDefault();navigate(nav.dataset.view,nav.dataset.topic||undefined);return;}
  const button=ev.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action;
  if(action==='seed'){ if(state.history.length&&!confirm('演示数据会替换当前本地记录，是否继续？'))return;state.history=seededDemoHistory();state.demo=true;save();render();toast('已加载虚构示例记录'); }
  if(action==='start'){state.topic='all';navigate('practice');}
  if(action==='practice-topic'){navigate('practice',button.dataset.topic);}
  if(action==='topic'){state.topic=button.dataset.topic;state.practiceMode='adaptive';setQuestion();render();}
  if(action==='choose'&&!state.answered){state.selected=Number(button.dataset.choice);render();app.querySelector(`[data-choice="${state.selected}"]`)?.focus();}
  if(action==='submit'&&state.selected!=null&&!state.answered){const q=getQuestion(state.questionId);if(!q)return;state.attempt={questionId:q.id,topic:q.topic,correct:state.selected===q.answer,selected:state.selected,at:Date.now(),mode:state.practiceMode};state.history.push(state.attempt);state.answered=true;save();render();app.querySelector('.answer-result')?.focus();toast(state.selected===q.answer?'回答正确，已记录':'已记录错题，及时复盘更有效');}
  if(action==='next'){setQuestion();render();}
  if(action==='error-reason'&&state.attempt&&!state.attempt.correct&&Object.hasOwn(ERROR_REASONS,button.dataset.value)){state.attempt.errorReason=button.dataset.value;save();render();app.querySelector(`[data-action="error-reason"][data-value="${button.dataset.value}"]`)?.focus();}
  if(action==='helpful'&&state.attempt&&['yes','no'].includes(button.dataset.value)){state.attempt.helpful=button.dataset.value;save();render();app.querySelector(`[data-action="helpful"][data-value="${button.dataset.value}"]`)?.focus();}
  if(action==='review-q'){state.topic='all';state.view='practice';state.practiceMode='review';setQuestion({questionId:button.dataset.qid});window.location.hash='practice';render();window.scrollTo(0,0);}
  if(action==='review-start'){state.view='practice';state.topic='all';state.practiceMode='review';setQuestion({mode:'review'});window.location.hash='practice';render();window.scrollTo(0,0);}
  if(action==='ai'){requestAI();}
});
document.querySelector('#reset-button').addEventListener('click',()=>{
  if (!confirm('确定清空本设备上的作答记录吗？此操作无法撤销。')) return;
  try {localStorage.removeItem(STORAGE_KEY);state.storageWarning='';} catch {state.storageWarning='无法清除浏览器持久记录，刷新后旧数据可能恢复。请检查存储权限。';}
  state.history=[];state.demo=false;state.topic='all';state.view='dashboard';setQuestion();window.location.hash='dashboard';render();toast(state.storageWarning||'本地学习记录已重置');
});
window.addEventListener('hashchange',()=>{
  const view=window.location.hash.slice(1);
  if(['dashboard','practice','review','product'].includes(view) && view!==state.view) {
    state.view=view;
    if(view==='practice')setQuestion();
    render();
  }
});
// On a static GitHub Pages deployment, the hash route remains usable after reload.
const initial=window.location.hash.replace('#','');
if(['dashboard','practice','review','product'].includes(initial)){state.view=initial;if(initial==='practice')setQuestion();}
render();
// Probe only a loopback development service. Pages (including custom domains) and file:// stay fully static.
if (location.hostname === '127.0.0.1' && location.protocol === 'http:' && !location.pathname.endsWith('preview.html')) {
  fetch('/api/capabilities').then(r=>r.ok?r.json():{ai:false}).then(data=>{state.aiAvailable=data.ai===true;if(state.view==='practice')render();}).catch(()=>{});
}
