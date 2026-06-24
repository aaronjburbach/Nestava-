// Nestava — public website lead capture.
// A lead submitted on a published site or an embedded widget lands in the
// owner's CRM as a contact (source=Website). If the org has Speed-to-Lead
// autopilot ON, an AI first touch is drafted immediately and logged as an
// auto_draft activity (surfaced in the CRM Morning Huddle).
//
// Uses the service-role key (bypasses RLS) so a logged-out visitor can create a
// contact ONLY through this controlled endpoint — no broad anonymous table
// grants. It DRAFTS the first touch; it does not auto-SEND (TCPA / consent
// gating is a Phase-2 punch-list item).
//
// Activate: SUPABASE_URL + SUPABASE_SERVICE_ROLE in Vercel env (already set).

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SVC = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function rest(path, opts = {}) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    method: opts.method || 'GET',
    headers: { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json', Prefer: opts.prefer || 'return=representation' },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
  if (!r.ok) throw new Error('supabase ' + r.status + ': ' + txt.slice(0, 200));
  return j;
}
async function readBody(req) {
  if (req.body) { if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } } return req.body; }
  return await new Promise(function (resolve) { var d = ''; req.on('data', function (c) { d += c; }); req.on('end', function () { try { resolve(JSON.parse(d || '{}')); } catch (e) { resolve({}); } }); req.on('error', function () { resolve({}); }); });
}

export default async function handler(req, res) {
  if (req.method === 'GET') { res.status(200).json({ ok: true, service: 'nestava-lead', configured: !!(SB_URL && SVC) }); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method_not_allowed' }); return; }
  if (!(SB_URL && SVC)) { res.status(200).json({ ok: false, error: 'not_configured' }); return; }
  try {
    var d = await readBody(req);
    if (d.company) { res.status(200).json({ ok: true }); return; } // honeypot — silently accept, drop
    var slug = String(d.slug || '').trim();
    var name = String(d.name || '').trim().slice(0, 120);
    var phone = String(d.phone || '').trim().slice(0, 40);
    var email = String(d.email || '').trim().slice(0, 160);
    var message = String(d.message || '').slice(0, 1000);
    var kind = String(d.kind || 'inquiry');
    if (!slug || !name || (!phone && !email)) { res.status(200).json({ ok: false, error: 'missing_fields' }); return; }

    var sites = await rest('sites?slug=eq.' + encodeURIComponent(slug) + '&select=org_id&limit=1');
    var org = sites && sites[0] && sites[0].org_id;
    if (!org) { res.status(200).json({ ok: false, error: 'site_not_found' }); return; }

    var rec = { org_id: org, name: name, source: 'Website', status: 'New Lead', stage: 'New', ctype: (kind === 'valuation' ? 'seller' : 'buyer'), last_touch_at: new Date().toISOString(), notes: (kind === 'valuation' ? 'Home valuation request. ' : '') + message };
    if (email) rec.email = email; if (phone) rec.phone = phone;
    var ins = await rest('contacts', { method: 'POST', prefer: 'return=representation', body: rec });
    var contact = Array.isArray(ins) ? ins[0] : ins;
    if (!contact || !contact.id) { res.status(200).json({ ok: false, error: 'insert_failed' }); return; }

    // Speed-to-Lead autopilot: draft an instant first touch if the org enabled it.
    var integ = await rest('integrations?org_id=eq.' + org + '&channel=eq.autopilot&select=id&limit=1');
    if (integ && integ.length) {
      var msg = '';
      try {
        var host = req.headers['x-forwarded-host'] || req.headers.host;
        var base = 'https://' + host;
        var goal = 'This is a brand-new inbound website lead' + (message ? (' who wrote: "' + message + '"') : '') + '. Send an instant, warm first response: thank them, ask one qualifying question (timeline or what they are looking for), and invite a reply. Under 60 words.';
        var r = await fetch(base + '/api/crm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'draft', channel: 'text', goal: goal, contact: { name: name, ctype: rec.ctype, stage: 'New', source: 'Website' }, activities: [] }) });
        var j = await r.json(); if (j && j.ok && j.message) msg = j.message;
      } catch (e) {}
      if (!msg) msg = 'Hi' + (name ? (' ' + name.split(' ')[0]) : '') + ', thanks for reaching out! Quick question so I can point you in the right direction — what are you looking for, and what’s your timeline?';
      // Resolve the {{agent}} merge field from the org's Brand Kit (the client
      // does this for in-app drafts; do it here for server-side web leads).
      try { var bk = await rest('brand_kits?org_id=eq.' + org + '&select=agent_name&limit=1'); var agentName = (bk && bk[0] && bk[0].agent_name) || ''; msg = msg.replace(/\{\{\s*agent\s*\}\}/g, agentName); } catch (e) { msg = msg.replace(/\{\{\s*agent\s*\}\}/g, ''); }
      msg = msg.replace(/[ \t]+\n/g, '\n').trim();
      try { await rest('activities', { method: 'POST', prefer: 'return=minimal', body: { org_id: org, contact_id: contact.id, kind: 'auto_draft', body: msg, summary: '⚡ AI first-touch drafted (speed-to-lead)' } }); } catch (e) {}
    }
    res.status(200).json({ ok: true });
  } catch (e) { res.status(200).json({ ok: false, error: 'error', message: String((e && e.message) || e).slice(0, 200) }); }
}
