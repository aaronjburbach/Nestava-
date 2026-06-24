// Nestava — CRM AI helper (Vercel serverless function)
// Uses the same LLM key strategy as /api/generate. Falls back gracefully.
//   OPENAI_API_KEY | GROQ_API_KEY | PERPLEXITY_API_KEY | ANTHROPIC_API_KEY

const PROVIDERS = [
  { env: 'OPENAI_API_KEY',     kind: 'openai',    url: 'https://api.openai.com/v1/chat/completions',     model: 'gpt-4o-mini',              json: true  },
  { env: 'GROQ_API_KEY',       kind: 'openai',    url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', json: true  },
  { env: 'PERPLEXITY_API_KEY', kind: 'openai',    url: 'https://api.perplexity.ai/chat/completions',      model: 'sonar',                  json: false },
  { env: 'ANTHROPIC_API_KEY',  kind: 'anthropic', url: 'https://api.anthropic.com/v1/messages',           model: 'claude-3-5-haiku-latest', json: false }
];
function pickProvider(){ for (const p of PROVIDERS){ if (process.env[p.env]) return p; } return null; }

var SYSTEM = 'You are an expert real estate agent\'s assistant. You write warm, concise, professional client messages and crisp internal notes. Never invent facts (exact prices, dates, school names) that were not provided. Follow U.S. Fair Housing rules. Keep messages natural and human — the agent will review before sending.';

function draftPrompt(d){
  var c = d.contact || {}; var acts = (d.activities || []).slice(0, 6);
  var lines = [
    'Draft a short, friendly follow-up '+(d.channel === 'email' ? 'email' : 'text message')+' from a real estate agent to this contact.',
    'Contact name: ' + (c.name || 'there'),
    c.ctype ? ('They are a ' + c.ctype) : null,
    c.stage ? ('Pipeline stage: ' + c.stage) : null,
    c.property_address ? ('Property of interest: ' + c.property_address) : null,
    c.source ? ('Lead source: ' + c.source) : null,
    acts.length ? ('Recent history (newest first):\n' + acts.map(function(a){ return '- ' + (a.kind || 'note') + ': ' + (a.summary || a.body || ''); }).join('\n')) : 'No prior contact yet.',
    d.goal ? ('Goal of this message: ' + d.goal) : 'Goal: re-engage and move them forward naturally.',
    'Rules: 40-90 words, sound like a real person, one clear call to action (a question or a next step), no emojis unless natural, sign off as the agent (use {{agent}} where the name goes). Return ONLY JSON: {"message":"..."}.'
  ].filter(Boolean);
  return lines.join('\n');
}
function summarizePrompt(d){
  return 'An agent logged this note about a contact named ' + ((d.contact && d.contact.name) || 'a lead') + ':\n"""\n' + (d.note || '') + '\n"""\n' +
    'Return ONLY JSON with two fields: "summary" (a tight one-line summary, max 12 words) and "task" (the single most useful next step as a short imperative, or "" if none is implied).';
}

async function callOpenAICompat(p, prompt){
  var payload = { model: p.model, messages: [ { role:'system', content: SYSTEM }, { role:'user', content: prompt } ], temperature: 0.8, max_tokens: 400 };
  if (p.json) payload.response_format = { type:'json_object' };
  var r = await fetch(p.url, { method:'POST', headers:{ 'Authorization':'Bearer '+process.env[p.env], 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error('provider '+r.status+': '+(await r.text()).slice(0,160));
  var j = await r.json(); return j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
}
async function callAnthropic(p, prompt){
  var r = await fetch(p.url, { method:'POST', headers:{ 'x-api-key':process.env[p.env], 'anthropic-version':'2023-06-01', 'Content-Type':'application/json' }, body: JSON.stringify({ model:p.model, max_tokens:400, temperature:0.8, system:SYSTEM, messages:[{role:'user',content:prompt}] }) });
  if (!r.ok) throw new Error('provider '+r.status+': '+(await r.text()).slice(0,160));
  var j = await r.json(); return j.content && j.content[0] && j.content[0].text;
}
function parseJSON(t){ if(!t) return null; try{ return JSON.parse(t); }catch(e){} var m=t.match(/\{[\s\S]*\}/); if(m){ try{ return JSON.parse(m[0]); }catch(e){} } return null; }
async function readBody(req){ if(req.body){ if(typeof req.body==='string'){ try{return JSON.parse(req.body);}catch(e){return {};} } return req.body; } return await new Promise(function(res){ var d=''; req.on('data',function(c){d+=c;}); req.on('end',function(){ try{res(JSON.parse(d||'{}'));}catch(e){res({});} }); req.on('error',function(){res({});}); }); }

export default async function handler(req, res){
  var provider = pickProvider();
  if (req.method === 'GET'){ res.status(200).json({ ok:true, service:'nestava-crm', configured: !!provider }); return; }
  if (req.method !== 'POST'){ res.status(405).json({ ok:false, error:'method_not_allowed' }); return; }
  if (!provider){ res.status(200).json({ ok:false, error:'no_key' }); return; }
  try{
    var data = await readBody(req);
    var prompt = data.action === 'summarize' ? summarizePrompt(data) : draftPrompt(data);
    var raw = provider.kind === 'anthropic' ? await callAnthropic(provider, prompt) : await callOpenAICompat(provider, prompt);
    var parsed = parseJSON(raw) || {};
    res.status(200).json(Object.assign({ ok:true }, parsed));
  }catch(e){ res.status(200).json({ ok:false, error:'provider_error', message:String((e&&e.message)||e).slice(0,200) }); }
}
