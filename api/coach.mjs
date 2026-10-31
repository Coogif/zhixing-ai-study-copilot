import { getQuestion } from '../src/questions.js';

function json(res,code,body) { res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body)); }
let windowStarted = 0, requests = 0, active = 0;
export async function handleCoach(req,res, { fetchModel = fetch, apiKey = process.env.OPENAI_API_KEY, timeoutMs = 18000 } = {}) {
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return json(res,403,{error:'仅接受同源本地请求'});
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return json(res,415,{error:'需要 application/json'});
  if(!apiKey)return json(res,503,{error:'未配置 OPENAI_API_KEY；请阅读 README 中的本地模型启用说明'});
  // Avoid accepting arbitrary user documents or raw prompts; accept an allowlisted question ID only.
  let payload='', bytes=0;
  for await (const chunk of req) {bytes+=Buffer.byteLength(chunk);if(bytes>4096)return json(res,413,{error:'Request too large'});payload+=chunk;}
  let body;try{body=JSON.parse(payload);}catch{return json(res,400,{error:'Invalid JSON'});}
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(res,400,{error:'Invalid payload'});
  const q=getQuestion(body.questionId);
  if(!q||!Number.isInteger(body.selected)||body.selected<0||body.selected>=q.options.length)return json(res,400,{error:'Invalid question or option'});
  if(Date.now()-windowStarted>=60000){windowStarted=Date.now();requests=0;}
  if(requests>=10||active>=1)return json(res,429,{error:'请求过于频繁，请稍后重试'});
  requests++;active++;
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const model=process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    const r=await fetchModel('https://api.openai.com/v1/responses',{
      method:'POST',signal:controller.signal,
      headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({model,max_output_tokens:400,instructions:'你是严谨的公考学习助教。使用简体中文，解释知识点和选项，不要夸大能力，不要编造学生历史。先告诉学生这题的结构，再分步骤讲解，最后给一个可迁移的解题提醒。答案和解析以提供的标准答案为准。',input:`题目：${q.stem}\n选项：${q.options.map((x,i)=>`${'ABCD'[i]}. ${x}`).join(' ')}\n学习者选择：${'ABCD'[body.selected]}\n标准答案：${'ABCD'[q.answer]}\n预写解析：${q.analysis.join(' ')}`})
    });
    const result=await r.json();
    if(!r.ok)return json(res,502,{error:'模型服务返回错误，请检查配置与额度'});
    const explanation=result.output_text || (result.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n');
    if(!explanation)return json(res,502,{error:'模型未生成文字讲解'});
    json(res,200,{explanation,mode:'llm'});
  } catch {json(res,504,{error:'模型请求超时或网络不可用'});} finally{clearTimeout(timeout);active--;}
}
