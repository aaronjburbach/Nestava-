// Nestava — Transact AI compliance reviewer (Vercel serverless).
// Reads a deal (type, price, dates, milestones, documents) and returns
// severity-ranked compliance/process findings. Multi-provider LLM, same key
// pattern as /api/crm and /api/generate. Draft/advisory only — not legal advice.

const PROVIDERS = [
  { env: 'OPENAI_API_KEY',     kind: 'openai',    url: 'https://api.openai.com/v1/chat/completions',     model: 'gpt-4o-mini',              json: true  },
  { env: 'GROQ_API_KEY',       kind: 'openai',    url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', json: true  },
  { env: 'PERPLEXITY_API_KEY', kind: 'openai',    url: 'https://api.perplexity.ai/chat/completions',      model: 'sonar',                  json: false },
  { env: 'ANTHROPIC_API_KEY',  kind: 'anthropic', url: 'https://api.anthropic.com/v1/messages',           model: 'claude-3-5-haiku-latest', json: false }
];
function pickProvider() { for (const p of PROVIDERS) { if (process.env[p.env]) return p; } return null; }

const SYSTEM =
  'You are an experienced U.S. real estate transaction compliance reviewer assisting a licensed agent. ' +
  'Given a deal, surface concrete compliance and process risks an agent or broker should act on: missing or unsigned required documents, blown or at-risk contingency deadlines, the federal Closing Disclosure 3-business-day delivery rule, earnest-money handling, missing disclosures (e.g., lead-based paint for pre-1978 homes, seller property disclosure), agency disclosure, and financing-contingency risk. ' +
  'Be specific and practical. Do NOT give legal advice or invent facts not present in the data. Flag uncertainty rather than fabricating. Never reference protected classes (Fair Housing).';

function buildPrompt(deal) {
  return 'Review this real estate deal and list the compliance/process findings.\n\nDEAL:\n' + JSON.stringify(deal, null, 2) +
    '\n\nReturn ONLY JSON: {"findings":[{"severity":"blocker|warn|ok","text":"the finding"}]}. ' +
    'Use "blocker" for things that can sink or legally jeopardize the deal, "warn" for risks/missing items, "ok" for positive confirmations. ' +
    'Return 3 to 7 findings, most important first. No markdown, no commentary.';
}
async function callOpenAI(p, prompt) {
  var payload = { model: p.model, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }], temperature: 0.4, max_tokens: 900 };
  if (p.json) payload.response_format = { type: 'json_object' };
  var r = await fetch(p.url, { method: 'POST', headers: { Authorization: 'Bearer ' + process.env[p.env], 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error('provider ' + r.status + ': ' + (await r.text()).slice(0, 160));
  var j = await r.json(); return j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
}
async function callAnthropic(p, prompt) {
  var r = await fetch(p.url, { method: 'POST', headers: { 'x-api-key': process.env[p.env], 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body: JSON.stringify({ model: p.model, max_tokens: 900, temperature: 0.4, system: SYSTEM, messages: [{ role: 'user', content: prompt }] }) });
  if (!r.ok) throw new Error('provider ' + r.status + ': ' + (await r.text()).slice(0, 160));
  var j = await r.json(); return j.content && j.content[0] && j.content[0].text;
}
function parse(txt) { if (!txt) return null; try { return JSON.parse(txt); } catch (e) {} var m = txt.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch (e) {} } return null; }
async function readBody(req) {
  if (req.body) { if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } } return req.body; }
  return await new Promise(function (res) { var d = ''; req.on('data', function (c) { d += c; }); req.on('end', function () { try { res(JSON.parse(d || '{}')); } catch (e) { res({}); } }); req.on('error', function () { res({}); }); });
}

export default async function handler(req, res) {
  var provider = pickProvider();
  if (req.method === 'GET') { res.status(200).json({ ok: true, service: 'nestava-transact', configured: !!provider, provider: provider ? provider.env.replace('_API_KEY', '').toLowerCase() : null }); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method_not_allowed' }); return; }
  if (!provider) { res.status(200).json({ ok: false, error: 'no_key' }); return; }
  try {
    var d = await readBody(req);
    var raw = provider.kind === 'anthropic' ? await callAnthropic(provider, buildPrompt(d.deal || {})) : await callOpenAI(provider, buildPrompt(d.deal || {}));
    var parsed = parse(raw) || {};
    var findings = Array.isArray(parsed.findings) ? parsed.findings.map(function (f) {
      var sev = String((f && f.severity) || 'warn').toLowerCase(); if (['blocker', 'warn', 'ok'].indexOf(sev) < 0) sev = 'warn';
      return { severity: sev, text: String((f && f.text) || '').trim() };
    }).filter(function (f) { return f.text; }).slice(0, 8) : [];
    if (!findings.length) { res.status(200).json({ ok: false, error: 'empty_result' }); return; }
    res.status(200).json({ ok: true, ai: true, findings: findings });
  } catch (e) { res.status(200).json({ ok: false, error: 'provider_error', message: String((e && e.message) || e).slice(0, 200) }); }
}
