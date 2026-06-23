// Nestava — AI marketing copy generator (Vercel serverless function)
// Runs on Vercel's Node runtime. Uses whichever LLM API key is present in the
// project's Environment Variables. If no key is set (or the call fails), it
// returns { ok:false } and the browser falls back to built-in templates, so the
// Create studio always produces something.
//
// To turn on real AI: add ONE of these env vars in Vercel → Settings →
// Environment Variables, then redeploy:
//   OPENAI_API_KEY        (OpenAI,      model gpt-4o-mini)
//   GROQ_API_KEY          (Groq,        model llama-3.3-70b-versatile)  ← free tier
//   PERPLEXITY_API_KEY    (Perplexity,  model sonar)
//   ANTHROPIC_API_KEY     (Anthropic,   model claude-3-5-haiku-latest)

const PROVIDERS = [
  { env: 'OPENAI_API_KEY',     kind: 'openai',    url: 'https://api.openai.com/v1/chat/completions',     model: 'gpt-4o-mini',               json: true  },
  { env: 'GROQ_API_KEY',       kind: 'openai',    url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile',   json: true  },
  { env: 'PERPLEXITY_API_KEY', kind: 'openai',    url: 'https://api.perplexity.ai/chat/completions',      model: 'sonar',                    json: false },
  { env: 'ANTHROPIC_API_KEY',  kind: 'anthropic', url: 'https://api.anthropic.com/v1/messages',           model: 'claude-3-5-haiku-latest',  json: false }
];

function pickProvider() {
  for (const p of PROVIDERS) { if (process.env[p.env]) return p; }
  return null;
}

const LABELS = {
  page:          'a single-property landing page: a strong headline, then 2-3 short descriptive paragraphs, then a bulleted list of 5-6 standout features, ending with a clear call to action',
  flyer:         'a printable listing flyer: a punchy headline, the key facts line, 5-6 feature bullets, an "Open House" line, and a closing contact line',
  social_listed: 'an upbeat "Just Listed" social post: 2-4 short lines that build excitement, then 5-7 relevant hashtags on the last line',
  social_open:   'an inviting "Open House" social post: mention the day/time (use a clear placeholder if unknown), 2-4 short lines, then 5-7 hashtags',
  social_sold:   'a celebratory "Just Sold" social post that quietly builds the agent\'s credibility and invites new clients, then 5-7 hashtags',
  email:         'a marketing email. Begin with a line "Subject: ..." then a warm, concise body addressed with a {{first_name}} merge field, one clear call to action, and a friendly sign-off',
  market:        'a professional local market-update post for LinkedIn: one tight insight paragraph, a practical takeaway for buyers and sellers, then 4-6 hashtags',
  ad:            'a paid lead ad. Clearly label the parts on their own lines: PRIMARY TEXT:, HEADLINE:, DESCRIPTION:, CTA BUTTON:'
};

const SYSTEM =
  'You are an expert real estate marketing copywriter. Write polished, specific, ready-to-publish copy an agent can use immediately with at most light edits. Keep it vivid but never cheesy, and vary your wording every time so regenerations feel fresh. ' +
  'Strictly follow U.S. Fair Housing rules: describe the PROPERTY and NEIGHBORHOOD only — never reference or imply race, color, religion, sex, familial status, national origin, disability, or what kind of person "should" live there. ' +
  'Never fabricate specific facts that were not provided (no invented school names, exact distances, tax or HOA dollar amounts, or award claims). When a detail is unknown, write around it gracefully.';

function fmtPrice(v) { var n = Number(v); return (v && !isNaN(n)) ? '$' + n.toLocaleString() : null; }

function buildPrompt(type, inputs) {
  var i = inputs || {};
  var facts = [
    i.addr ? 'Address / area: ' + i.addr : null,
    i.beds ? 'Bedrooms: ' + i.beds : null,
    i.baths ? 'Bathrooms: ' + i.baths : null,
    i.sqft ? 'Square feet: ' + i.sqft : null,
    fmtPrice(i.price) ? 'List price: ' + fmtPrice(i.price) : null
  ].filter(Boolean).join('\n');
  var want = LABELS[type] || 'a real estate marketing asset';
  return 'Write ' + want + '.\n\n' +
    'Property details:\n' + (facts || '(No specific details were given — write compelling general copy the agent can personalize.)') + '\n\n' +
    'Return ONLY a JSON object with exactly two string fields:\n' +
    '  "title" — a short internal name for this asset (e.g. "Just Listed — 1234 Oak St")\n' +
    '  "body"  — the finished copy, using real line breaks (\\n) between lines and paragraphs.\n' +
    'No markdown, no commentary, just the JSON object.';
}

async function callOpenAICompat(p, prompt) {
  var payload = {
    model: p.model,
    messages: [ { role: 'system', content: SYSTEM }, { role: 'user', content: prompt } ],
    temperature: 0.9,
    max_tokens: 1000
  };
  if (p.json) payload.response_format = { type: 'json_object' };
  var r = await fetch(p.url, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + process.env[p.env], 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error('provider ' + r.status + ': ' + (await r.text()).slice(0, 200));
  var j = await r.json();
  return j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
}

async function callAnthropic(p, prompt) {
  var r = await fetch(p.url, {
    method: 'POST',
    headers: { 'x-api-key': process.env[p.env], 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: p.model, max_tokens: 1000, temperature: 0.9, system: SYSTEM, messages: [ { role: 'user', content: prompt } ] })
  });
  if (!r.ok) throw new Error('provider ' + r.status + ': ' + (await r.text()).slice(0, 200));
  var j = await r.json();
  return j.content && j.content[0] && j.content[0].text;
}

function parseResult(txt) {
  if (!txt) return null;
  try { return JSON.parse(txt); } catch (e) {}
  var m = txt.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return { title: '', body: String(txt).trim() }; // last resort: use raw text as body
}

async function readBody(req) {
  if (req.body) {
    if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
    return req.body;
  }
  return await new Promise(function (resolve) {
    var d = '';
    req.on('data', function (c) { d += c; });
    req.on('end', function () { try { resolve(JSON.parse(d || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

export default async function handler(req, res) {
  var provider = pickProvider();

  // Health check / config probe
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, service: 'nestava-generate', configured: !!provider, provider: provider ? provider.env.replace('_API_KEY', '').toLowerCase() : null });
    return;
  }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method_not_allowed' }); return; }
  if (!provider) { res.status(200).json({ ok: false, error: 'no_key', message: 'No AI key configured on the server.' }); return; }

  try {
    var data = await readBody(req);
    var prompt = buildPrompt(data.type, data.inputs);
    var raw = provider.kind === 'anthropic' ? await callAnthropic(provider, prompt) : await callOpenAICompat(provider, prompt);
    var parsed = parseResult(raw) || {};
    if (!parsed.body || !String(parsed.body).trim()) { res.status(200).json({ ok: false, error: 'empty_result' }); return; }
    res.status(200).json({ ok: true, ai: true, title: parsed.title || '', body: String(parsed.body).trim() });
  } catch (e) {
    res.status(200).json({ ok: false, error: 'provider_error', message: String((e && e.message) || e).slice(0, 300) });
  }
}
