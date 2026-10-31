import { QUESTIONS } from './questions.js';

export const STORAGE_KEY = 'zhixing-study-mvp-v1';
export const ERROR_REASONS = { concept: '概念不清', method: '方法选错', careless: '读题或计算疏漏', unsure: '还不确定' };

export function normalizeSaved(value, now = Date.now()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { history: [], demo: false };
  const history = (Array.isArray(value.history) ? value.history : []).flatMap(h => {
    if (!h || typeof h !== 'object') return [];
    const q = QUESTIONS.find(q => q.id === h.questionId);
    if (!q || !Number.isInteger(h.selected) || h.selected < 0 || h.selected >= q.options.length ||
        !Number.isFinite(h.at) || h.at < 0 || h.at > now + 300000) return [];
    return [{ questionId: q.id, topic: q.topic, selected: h.selected, correct: h.selected === q.answer, at: h.at,
      ...(Object.hasOwn(ERROR_REASONS, h.errorReason) ? { errorReason: h.errorReason } : {}),
      ...(['yes', 'no'].includes(h.helpful) ? { helpful: h.helpful } : {}),
      ...(h.mode === 'review' ? { mode: 'review' } : {}) }];
  }).sort((a,b) => a.at - b.at);
  return { history, demo: value.demo === true };
}

export function readSaved(storage) {
  try { return { ...normalizeSaved(JSON.parse(storage.getItem(STORAGE_KEY) || '{}')), warning: '' }; }
  catch { return { history: [], demo: false, warning: '本地记录不可用或格式损坏。本次仍可练习；请检查浏览器存储设置。' }; }
}
