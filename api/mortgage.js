// Nestava — Mortgage AI co-pilot + RESPA-aware co-marketing copy (serverless).
// Multi-provider LLM (same key pattern as the other /api endpoints).
//   action "chat"        -> { answer } : explains concepts, models scenarios.
//   action "comarketing" -> { body }   : co-branded financing one-sheet copy.
// Guardrails: educational only, NOT a lender, no binding rate/APR quotes, point
// borrowers to a licensed LO; RESPA Section 8 + TRID aware; Fair Housing.

const PROVIDERS = [
  { env: 'OPENAI_API_KEY',     kind: 'openai',    url: 'https://api.openai.com/v1/chat/completions',     model: 'gpt-4o-mini' },
  { env: 'GROQ_API_KEY',       kind: 'openai',    url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  { env: 'PERPLEXITY_API_KEY', kind: 'openai',    url: 'https://api.perplexity.ai/chat/completions',      model: 'sonar' },
  { env: 'ANTHROPIC_API_KEY',  kind: 'anthropic', url: 'https://api.anthropic.com/v1/messages',           model: 'claude-3-5-haiku-latest' }
];
function pickProvider() { for (const p of PROVIDERS) { if (process.env[p.env]) return p; } return null; }

const SYSTEM =
  'You are a knowledgeable mortgage co-pilot helping a licensed real estate AGENT (not the borrower directly). Explain financing concepts clearly and model scenarios (FHA/VA/conventional/DSCR, buydowns, points, seller concessions, refi breakeven, DTI). ' +
  'Hard rules: you are NOT a lender or mortgage broker. Never present a specific interest rate or APR as an available offer or a guarantee; if you use a rate in an example, label it illustrative. Do not give legal or tax advice. For anything binding, tell the agent to connect the client with a licensed loan officer. ' +
  'Be RESPA Section 8 aware (no pay-for-referrals; co-marketing must reflect each party’s fair pro-rata share of actual services) and TRID aware (Loan Estimate / Closing Disclosure timing). Strictly follow Fair Housing — never reference protected classes. Keep answers concise and practical.';

async function callOpenAI(p, messages) {
  var r = await fetch(p.url, { method: 'POST', headers: { Authorization: 'Bearer ' + process.env[p.env], 'Content-Type': 'application/json' }, body: JSON.stringify({ model: p.model, messages: messages, temperature: 0.6, max_tokens: 700 }) });
  if (!r.ok) throw new Error('provider ' + r.status + ': ' + (await r.text()).slice(0, 160));
  var j = await r.json(); return j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
}
async function callAnthropic(p, messages) {
  var sys = messages.find(function (m) { return m.role === 'system'; });
  var rest = messages.filter(function (m) { return m.role !== 'system'; });
  var r = await fetch(p.url, { method: 'POST', headers: { 'x-api-key': process.env[p.env], 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body: JSON.stringify({ model: p.model, max_tokens: 700, temperature: 0.6, system: sys ? sys.content : SYSTEM, messages: rest }) });
  if (!r.ok) throw new Error('provider ' + r.status + ': ' + (await r.text()).slice(0, 160));
  var j = await r.json(); return j.content && j.content[0] && j.content[0].text;
}
async function readBody(req) {
  if (req.body) { if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } } return req.body; }
  return await new Promise(function (res) { var d = ''; req.on('data', function (c) { d += c; }); req.on('end', function () { try { res(JSON.parse(d || '{}')); } catch (e) { res({}); } }); req.on('error', function () { res({}); }); });
}

export default async function handler(req, res) {
  var provider = pickProvider();
  if (req.method === 'GET') { res.status(200).json({ ok: true, service: 'nestava-mortgage', configured: !!provider, provider: provider ? provider.env.replace('_API_KEY', '').toLowerCase() : null }); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method_not_allowed' }); return; }
  if (!provider) { res.status(200).json({ ok: false, error: 'no_key' }); return; }
  try {
    var d = await readBody(req);
    var messages;
    if (d.action === 'comarketing') {
      var lo = d.lo || {}, agent = d.agent || {}, listing = d.listing || '';
      var u = 'Write a short, friendly co-branded "financing options" one-sheet an agent and a loan officer can share for ' + (listing ? ('the listing at ' + listing) : 'a home purchase') + '. ' +
        'Loan officer: ' + (lo.name || '[LO name]') + (lo.company ? (', ' + lo.company) : '') + (lo.nmls ? (' (NMLS #' + lo.nmls + ')') : '') + '. Agent: ' + (agent.name || '[Agent]') + (agent.brokerage ? (', ' + agent.brokerage) : '') + '. ' +
        'Cover: a couple of common loan options at a high level (conventional/FHA/VA), the value of getting pre-approved, and a clear call to contact the LO. Use ONLY illustrative, clearly-labeled example figures (no quoted rates as offers). End with a one-line RESPA note that this co-marketing reflects each party’s fair share of costs and is not contingent on referrals. Return plain text, ~150 words.';
      messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: u }];
      var raw = provider.kind === 'anthropic' ? await callAnthropic(provider, messages) : await callOpenAI(provider, messages);
      if (!raw) { res.status(200).json({ ok: false, error: 'empty_result' }); return; }
      res.status(200).json({ ok: true, ai: true, body: String(raw).trim() });
      return;
    }
    // default: chat
    var history = Array.isArray(d.messages) ? d.messages.slice(-8) : [];
    var ctx = d.context ? ('\n\nContext from the agent’s current scenario: ' + JSON.stringify(d.context)) : '';
    messages = [{ role: 'system', content: SYSTEM + ctx }].concat(history).concat(d.question ? [{ role: 'user', content: String(d.question) }] : []);
    var ans = provider.kind === 'anthropic' ? await callAnthropic(provider, messages) : await callOpenAI(provider, messages);
    if (!ans) { res.status(200).json({ ok: false, error: 'empty_result' }); return; }
    res.status(200).json({ ok: true, ai: true, answer: String(ans).trim() });
  } catch (e) { res.status(200).json({ ok: false, error: 'provider_error', message: String((e && e.message) || e).slice(0, 200) }); }
}
