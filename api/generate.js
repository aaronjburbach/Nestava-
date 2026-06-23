// Nestava — AI marketing copy generator (Vercel serverless function)
// build: groq-enabled, structured output for designed assets
//
// Runs on Vercel's Node runtime. Uses whichever LLM API key is present in the
// project's Environment Variables. If no key is set (or the call fails), it
// returns { ok:false } and the browser falls back to built-in templates.
//
// Env keys (any one): OPENAI_API_KEY | GROQ_API_KEY | PERPLEXITY_API_KEY | ANTHROPIC_API_KEY

const PROVIDERS = [
  { env: 'OPENAI_API_KEY',     kind: 'openai',    url: 'https://api.openai.com/v1/chat/completions',     model: 'gpt-4o-mini',              json: true  },
  { env: 'GROQ_API_KEY',       kind: 'openai',    url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', json: true  },
  { env: 'PERPLEXITY_API_KEY', kind: 'openai',    url: 'https://api.perplexity.ai/chat/completions',      model: 'sonar',                  json: false },
  { env: 'ANTHROPIC_API_KEY',  kind: 'anthropic', url: 'https://api.anthropic.com/v1/messages',           model: 'claude-3-5-haiku-latest', json: false }
];

function pickProvider() {
  for (const p of PROVIDERS) { if (process.env[p.env]) return p; }
  return null;
}

const LABELS = {
  flyer:         'a printable LISTING FLYER for a home',
  social_listed: 'a "Just Listed" social media post',
  social_open:   'an "Open House" social media post',
  social_sold:   'a "Just Sold" social media post',
  page:          'a single-property landing-page description',
  email:         'a marketing email to a contact list',
  market:        'a local real-estate market-update post',
  ad:            'a paid lead-generation ad'
};

const SYSTEM =
  'You are an expert real estate marketing copywriter and art director. Write polished, specific, ready-to-publish copy an agent can use immediately. Be vivid but never cheesy, and vary wording each time so regenerations feel fresh. ' +
  'Strictly follow U.S. Fair Housing rules: describe the PROPERTY and NEIGHBORHOOD only — never reference or imply race, color, religion, sex, familial status, national origin, disability, or who "should" live there. ' +
  'Never fabricate specific facts that were not provided (no invented school names, exact distances, tax/HOA amounts, or awards). When a detail is unknown, write around it gracefully.';

function fmtPrice(v) { var n = Number(v); return (v && !isNaN(n)) ? '$' + n.toLocaleString() : null; }

function buildPrompt(type, inputs) {
  var i = inputs || {};
  var facts = [
    i.addr ? 'Address / area: ' + i.addr : null,
    i.beds ? 'Bedrooms: ' + i.beds : null,
    i.baths ? 'Bathrooms: ' + i.baths : null,
    i.sqft ? 'Square feet: ' + i.sqft : null,
    fmtPrice(i.price) ? 'List price: ' + fmtPrice(i.price) : null,
    i.highlights ? 'Agent highlights to feature: ' + i.highlights : null,
    (i.ohDate || i.ohTime) ? 'Open house: ' + [i.ohDate, i.ohTime].filter(Boolean).join(' ') : null
  ].filter(Boolean).join('\n');
  var want = LABELS[type] || 'a real estate marketing asset';

  return 'Create the copy for ' + want + '.\n\n' +
    'Property details:\n' + (facts || '(No specific details were given — write compelling general copy the agent can personalize.)') + '\n\n' +
    'Return ONLY a JSON object with these fields (use real \\n line breaks inside strings):\n' +
    '  "title"    — a short internal name for this asset (e.g. "Just Listed — 1234 Oak St")\n' +
    '  "headline" — ONE short, punchy marketing line, max ~8 words, no price, no hashtags (used as the big headline on a flyer/graphic)\n' +
    '  "bullets"  — an array of 5 to 6 SHORT feature phrases (3-6 words each, no leading dash), the kind printed on a listing flyer\n' +
    '  "caption"  — a ready-to-post caption. For social posts include 4-7 relevant hashtags on the final line. For email start with "Subject: ..." then the body with a {{first_name}} merge field. For other types, a 1-2 sentence caption.\n' +
    '  "body"     — the full long-form copy where it applies (landing page description, full email, market update, or ad with PRIMARY TEXT / HEADLINE / DESCRIPTION / CTA labels). For flyer/social this can repeat the caption.\n' +
    'Populate every field that is relevant to ' + (want) + '. No markdown, no commentary — just the JSON object.';
}

async function callOpenAICompat(p, prompt) {
  var payload = {
    model: p.model,
    messages: [ { role: 'system', content: SYSTEM }, { role: 'user', content: prompt } ],
    temperature: 0.9,
    max_tokens: 1100
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
    body: JSON.stringify({ model: p.model, max_tokens: 1100, temperature: 0.9, system: SYSTEM, messages: [ { role: 'user', content: prompt } ] })
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
  return { body: String(txt).trim() };
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
    var bullets = Array.isArray(parsed.bullets) ? parsed.bullets.map(function (b) { return String(b).replace(/^[-•\s]+/, '').trim(); }).filter(Boolean).slice(0, 6) : [];
    var out = {
      title:    parsed.title    ? String(parsed.title).trim()    : '',
      headline: parsed.headline ? String(parsed.headline).trim() : '',
      bullets:  bullets,
      caption:  parsed.caption  ? String(parsed.caption).trim()  : '',
      body:     parsed.body     ? String(parsed.body).trim()     : ''
    };
    if (!out.body && !out.caption && !out.headline && !out.bullets.length) {
      res.status(200).json({ ok: false, error: 'empty_result' });
      return;
    }
    res.status(200).json(Object.assign({ ok: true, ai: true }, out));
  } catch (e) {
    res.status(200).json({ ok: false, error: 'provider_error', message: String((e && e.message) || e).slice(0, 300) });
  }
}
