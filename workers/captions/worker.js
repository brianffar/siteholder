// siteholder-captions: Cloudflare Worker, route siteholderrecords.com/admin/api/captions*
// Cloudflare Access protects the route; this Worker also refuses anything without the Access header.
// Secrets: SHEET_URL (Apps Script web app URL), SHEET_SECRET (same value as the script's SECRET property).
export default {
  async fetch(req, env) {
    const j = (o, s = 200) => new Response(JSON.stringify(o), {status: s, headers: {'content-type': 'application/json', 'cache-control': 'no-store'}});
    if (!req.headers.get('cf-access-jwt-assertion')) return j({error: 'forbidden'}, 403);
    if (!env.SHEET_URL || !env.SHEET_SECRET) return j({error: 'not configured'}, 503);
    try {
      let r;
      if (req.method === 'POST') {
        const b = await req.json();
        r = await fetch(env.SHEET_URL, {method: 'POST', redirect: 'follow', headers: {'content-type': 'text/plain'},
          body: JSON.stringify({secret: env.SHEET_SECRET, n: b.n, caption: b.caption})});
      } else {
        r = await fetch(env.SHEET_URL + '?secret=' + encodeURIComponent(env.SHEET_SECRET), {redirect: 'follow'});
      }
      return new Response(await r.text(), {status: r.ok ? 200 : 502, headers: {'content-type': 'application/json', 'cache-control': 'no-store'}});
    } catch (e) {
      return j({error: 'sheet unreachable'}, 502);
    }
  }
};
