// Nestava — outbound comms (Vercel serverless). Gated by env keys; live the
// moment they're added. Email via Resend, SMS via Twilio.
//   RESEND_API_KEY (+ RESEND_FROM)         -> email
//   TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM -> SMS

async function sendEmail(to, subject, body){
  var key = process.env.RESEND_API_KEY;
  var from = process.env.RESEND_FROM || 'Nestava <onboarding@resend.dev>';
  if (!key) return { ok:false, error:'no_key' };
  if (!to) return { ok:false, error:'no_recipient' };
  var html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#13241f">' + String(body||'').replace(/</g,'&lt;').replace(/\n/g,'<br>') + '</div>';
  var r = await fetch('https://api.resend.com/emails', { method:'POST', headers:{ 'Authorization':'Bearer '+key, 'Content-Type':'application/json' }, body: JSON.stringify({ from:from, to:[to], subject: subject||'A note from your agent', html: html }) });
  if (!r.ok) return { ok:false, error:'send_failed', message:(await r.text()).slice(0,160) };
  return { ok:true, channel:'email' };
}
async function sendSms(to, body){
  var sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM;
  if (!sid || !tok || !from) return { ok:false, error:'no_key' };
  if (!to) return { ok:false, error:'no_recipient' };
  var form = new URLSearchParams(); form.append('To', to); form.append('From', from); form.append('Body', String(body||''));
  var r = await fetch('https://api.twilio.com/2010-04-01/Accounts/'+sid+'/Messages.json', { method:'POST', headers:{ 'Authorization':'Basic '+Buffer.from(sid+':'+tok).toString('base64'), 'Content-Type':'application/x-www-form-urlencoded' }, body: form.toString() });
  if (!r.ok) return { ok:false, error:'send_failed', message:(await r.text()).slice(0,160) };
  return { ok:true, channel:'sms' };
}
async function readBody(req){ if(req.body){ if(typeof req.body==='string'){ try{return JSON.parse(req.body);}catch(e){return {};} } return req.body; } return await new Promise(function(res){ var d=''; req.on('data',function(c){d+=c;}); req.on('end',function(){ try{res(JSON.parse(d||'{}'));}catch(e){res({});} }); req.on('error',function(){res({});}); }); }

export default async function handler(req, res){
  if (req.method === 'GET'){
    res.status(200).json({ ok:true, service:'nestava-comms', email: !!process.env.RESEND_API_KEY, sms: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) });
    return;
  }
  if (req.method !== 'POST'){ res.status(405).json({ ok:false, error:'method_not_allowed' }); return; }
  try{
    var d = await readBody(req);
    var out = d.channel === 'email' ? await sendEmail(d.to, d.subject, d.body) : await sendSms(d.to, d.body);
    res.status(200).json(out);
  }catch(e){ res.status(200).json({ ok:false, error:'error', message:String((e&&e.message)||e).slice(0,160) }); }
}
