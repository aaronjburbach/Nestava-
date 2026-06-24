// Nestava — MLS / IDX connector (Vercel serverless function)
//
// Proxies a real estate listing feed server-side and normalizes it to a common
// shape the app can use (search + per-listing import + photo proxy).
//
// PROVIDER: set MLS_PROVIDER + credentials in Vercel env to go live with the
// agent's MLS-approved IDX feed. With nothing configured it uses the public
// SimplyRETS DEMO feed (sample listings) so the flow works end-to-end today.
//   SimplyRETS:  SIMPLYRETS_KEY + SIMPLYRETS_SECRET   (demo: simplyrets/simplyrets)
// Architecture leaves room for Bridge Interactive / Trestle / MLS Grid adapters.

function creds() {
  var k = process.env.SIMPLYRETS_KEY, s = process.env.SIMPLYRETS_SECRET;
  if (k && s) return { user: k, pass: s, demo: false };
  return { user: 'simplyrets', pass: 'simplyrets', demo: true };
}

function authHeader(c) {
  return 'Basic ' + Buffer.from(c.user + ':' + c.pass).toString('base64');
}

function normalize(p) {
  var a = p.address || {}, pr = p.property || {};
  var bathsFull = pr.bathsFull || 0, bathsHalf = pr.bathsHalf || 0;
  var baths = bathsFull + bathsHalf * 0.5;
  var full = a.full || [a.streetNumberText || a.streetNumber, a.streetName].filter(Boolean).join(' ');
  var cityState = [a.city, a.state].filter(Boolean).join(', ') + (a.postalCode ? (' ' + a.postalCode) : '');
  return {
    id: String(p.listingId || p.mlsId || ''),
    mls: (p.mls && p.mls.name) || 'MLS',
    status: (p.mls && p.mls.status) || 'Active',
    address: full,
    cityState: cityState,
    fullAddress: [full, cityState].filter(Boolean).join(', '),
    price: p.listPrice || 0,
    beds: pr.bedrooms || '',
    baths: baths ? (baths % 1 === 0 ? String(baths) : baths.toFixed(1)) : '',
    sqft: pr.area || '',
    type: pr.type || '',
    remarks: p.remarks || '',
    photos: (p.photos || []).filter(Boolean).slice(0, 8),
    listDate: p.listDate || '',
    disclaimer: p.disclaimer || ''
  };
}

async function fetchListings(c, params) {
  var base = 'https://api.simplyrets.com/properties';
  var qs = [];
  qs.push('limit=' + encodeURIComponent(params.limit || 18));
  if (params.q) qs.push('q=' + encodeURIComponent(params.q));
  if (params.minprice) qs.push('minprice=' + encodeURIComponent(params.minprice));
  if (params.maxprice) qs.push('maxprice=' + encodeURIComponent(params.maxprice));
  if (params.minbeds) qs.push('minbeds=' + encodeURIComponent(params.minbeds));
  var url = base + '?' + qs.join('&');
  var r = await fetch(url, { headers: { 'Authorization': authHeader(c), 'Accept': 'application/json' } });
  if (!r.ok) throw new Error('feed ' + r.status + ': ' + (await r.text()).slice(0, 160));
  var data = await r.json();
  return Array.isArray(data) ? data.map(normalize) : [];
}

export default async function handler(req, res) {
  var c = creds();
  var url = new URL(req.url, 'http://x');
  var action = url.searchParams.get('action') || '';

  // Photo proxy — streams listing image bytes same-origin so the browser can
  // composite them into designs and export to PNG without canvas tainting.
  if (action === 'photo') {
    var src = url.searchParams.get('url') || '';
    if (!/^https?:\/\//i.test(src)) { res.status(400).json({ ok: false, error: 'bad_url' }); return; }
    try {
      var img = await fetch(src);
      if (!img.ok) { res.status(502).json({ ok: false, error: 'fetch_failed' }); return; }
      var buf = Buffer.from(await img.arrayBuffer());
      res.setHeader('Content-Type', img.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).send(buf);
    } catch (e) { res.status(502).json({ ok: false, error: 'proxy_error' }); }
    return;
  }

  // Health / status
  if (!action || action === 'status') {
    res.status(200).json({ ok: true, service: 'nestava-mls', provider: 'simplyrets', demo: c.demo });
    return;
  }

  if (action === 'search') {
    try {
      var params = {
        q: url.searchParams.get('q') || '',
        minprice: url.searchParams.get('minprice') || '',
        maxprice: url.searchParams.get('maxprice') || '',
        minbeds: url.searchParams.get('minbeds') || '',
        limit: url.searchParams.get('limit') || 18
      };
      var list = await fetchListings(c, params);
      // Demo feed has a small fixed sample set; if a keyword filtered everything
      // out, fall back to the unfiltered sample so the agent always sees listings.
      if (!list.length && params.q) { list = await fetchListings(c, { limit: params.limit }); }
      res.status(200).json({ ok: true, demo: c.demo, count: list.length, listings: list });
    } catch (e) {
      res.status(200).json({ ok: false, error: 'feed_error', message: String((e && e.message) || e).slice(0, 200) });
    }
    return;
  }

  res.status(400).json({ ok: false, error: 'unknown_action' });
}
