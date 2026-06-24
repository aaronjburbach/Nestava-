// Nestava — unattended automation tick (Vercel Cron, daily).
// Advances due Action Plan (sequence) steps across ALL orgs, server-side, with
// no user session. Gated by SUPABASE_SERVICE_ROLE (service-role key bypasses RLS
// so the tick can read/write across tenants). Each advanced step is logged as an
// activity and the next step is requeued — the same logic the in-app "Done"
// button runs, but autonomous.
//
// SAFETY: this version does NOT auto-SEND to live email/SMS channels. It advances
// the plan and records the step so the work surfaces in the agent's Morning
// Huddle. Autonomous live send (with TCPA / DNC / consent gating) is a Phase-2
// item — see the build punch list.
//
// Activate: set SUPABASE_URL + SUPABASE_SERVICE_ROLE in Vercel env. Optionally set
// CRON_SECRET; Vercel then sends "Authorization: Bearer <secret>" on cron calls
// and this endpoint will require it.
//   Health probe: GET /api/cron?health=1  -> { ok, configured }

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SVC = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function rest(path, opts = {}) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    method: opts.method || 'GET',
    headers: {
      apikey: SVC,
      Authorization: 'Bearer ' + SVC,
      'Content-Type': 'application/json',
      Prefer: opts.prefer || 'return=representation',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const txt = await r.text();
  let json = null; try { json = txt ? JSON.parse(txt) : null; } catch (e) {}
  if (!r.ok) throw new Error('supabase ' + r.status + ': ' + txt.slice(0, 200));
  return json;
}

function stepGap(steps, fromIdx, toIdx) {
  var a = (steps[toIdx] && Number(steps[toIdx].day)) || 0;
  var b = (steps[fromIdx] && Number(steps[fromIdx].day)) || 0;
  return Math.max(0, a - b);
}

async function runTick() {
  const now = new Date();
  const nowIso = now.toISOString();
  // Due, still-active enrollments (cap per run so the function stays well under
  // its time budget; the next daily tick picks up any remainder).
  const due = await rest('sequence_enrollments?status=eq.active&next_due_at=lte.' +
    encodeURIComponent(nowIso) + '&select=id,org_id,contact_id,sequence_id,current_step&limit=500');
  if (!due || !due.length) return { due: 0, advanced: 0, completed: 0 };

  const seqIds = Array.from(new Set(due.map(function (e) { return e.sequence_id; }).filter(Boolean)));
  const seqs = seqIds.length
    ? await rest('sequences?id=in.(' + seqIds.map(function (s) { return '"' + s + '"'; }).join(',') + ')&select=id,name,steps')
    : [];
  const seqMap = {}; (seqs || []).forEach(function (s) { seqMap[s.id] = s; });

  let advanced = 0, completed = 0;
  for (const e of due) {
    const seq = seqMap[e.sequence_id]; if (!seq) continue;
    const steps = seq.steps || []; const step = steps[e.current_step]; if (!step) continue;
    const kind = step.channel === 'task' ? 'note' : (step.channel || 'note');
    const summary = 'Action plan: ' + (step.title || step.subject || String(step.body || '').slice(0, 48));
    try {
      await rest('activities', { method: 'POST', prefer: 'return=minimal',
        body: { org_id: e.org_id, contact_id: e.contact_id, kind: kind, summary: summary } });
      await rest('contacts?id=eq.' + e.contact_id, { method: 'PATCH', prefer: 'return=minimal',
        body: { last_touch_at: nowIso } });
    } catch (err) { /* keep going */ }

    const next = e.current_step + 1;
    let upd;
    if (next >= steps.length) { upd = { current_step: next, status: 'done', next_due_at: null }; completed++; }
    else { upd = { current_step: next, next_due_at: new Date(now.getTime() + stepGap(steps, e.current_step, next) * 86400000).toISOString() }; }
    try { await rest('sequence_enrollments?id=eq.' + e.id, { method: 'PATCH', prefer: 'return=minimal', body: upd }); advanced++; } catch (err) {}
  }
  return { due: due.length, advanced, completed };
}

export default async function handler(req, res) {
  const configured = !!(SB_URL && SVC);
  const q = req.query || {};
  if (req.method === 'GET' && (q.health || q.h)) {
    res.status(200).json({ ok: true, service: 'nestava-cron', configured });
    return;
  }
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = (req.headers && req.headers.authorization) || '';
    if (auth !== 'Bearer ' + secret) { res.status(401).json({ ok: false, error: 'unauthorized' }); return; }
  }
  if (!configured) { res.status(200).json({ ok: false, error: 'not_configured', need: 'SUPABASE_SERVICE_ROLE' }); return; }
  try { const out = await runTick(); res.status(200).json({ ok: true, ...out, at: new Date().toISOString() }); }
  catch (e) { res.status(200).json({ ok: false, error: 'tick_failed', message: String((e && e.message) || e).slice(0, 200) }); }
}
