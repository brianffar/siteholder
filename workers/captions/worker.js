// siteholder-captions: Cloudflare Worker.
// Routes: siteholderrecords.com/admin/api/captions*  and  siteholderrecords.com/admin/api/media*
// Cloudflare Access protects the routes; this Worker also refuses anything without the Access header.
// Secrets: SHEET_URL (Apps Script web app URL), SHEET_SECRET (same value as the script's SECRET property).
// R2 binding: MEDIA (the bucket behind https://audio.siteholderrecords.com/).
const PREV = /^[a-z0-9]+\/\d\d-[a-z0-9-]+\.mp3$/;   // site previews, e.g. shuc004/02-teflon-villain-original-mix.mp3
const KEY = /^share\/(reels|images)\/[a-z0-9-]+\.(mp4|png)$/;
export default {
  async fetch(req, env) {
    const j = (o, s = 200) => new Response(JSON.stringify(o), {status: s, headers: {'content-type': 'application/json', 'cache-control': 'no-store'}});
    if (!req.headers.get('cf-access-jwt-assertion')) return j({error: 'forbidden'}, 403);
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith('/admin/api/media')) {
        if (!env.MEDIA) return j({error: 'storage not connected'}, 503);
        if (req.method === 'POST') {            // link a finished upload into the sheet
          if (!env.SHEET_URL || !env.SHEET_SECRET) return j({error: 'not configured'}, 503);
          const b = await req.json();
          const r = await fetch(env.SHEET_URL, {method: 'POST', redirect: 'follow', headers: {'content-type': 'text/plain'},
            body: JSON.stringify({secret: env.SHEET_SECRET, action: 'reel', kind: b.kind, key: b.key, reel: b.reel, image: b.image})});
          return new Response(await r.text(), {status: r.ok ? 200 : 502, headers: {'content-type': 'application/json', 'cache-control': 'no-store'}});
        }
        const key = url.searchParams.get('key') || '';
        if (!KEY.test(key) && !PREV.test(key)) return j({error: 'bad file name'}, 400);
        if (req.method === 'PUT') {
          const type = key.endsWith('.mp4') ? 'video/mp4' : key.endsWith('.mp3') ? 'audio/mpeg' : 'image/png';
          if (PREV.test(key)) {                 // keep the old preview so a replacement can be undone
            const old = await env.MEDIA.get(key);
            if (old) await env.MEDIA.put('_backup/' + new Date().toISOString().replace(/[:.]/g, '-') + '/' + key, old.body, {httpMetadata: {contentType: 'audio/mpeg'}});
          }
          const o = await env.MEDIA.put(key, req.body, {httpMetadata: {contentType: type, cacheControl: 'public, max-age=300'}});
          return j({ok: true, size: o.size});
        }
        const h = await env.MEDIA.head(key);
        return j({exists: !!h, size: h ? h.size : 0});
      }
      if (!env.SHEET_URL || !env.SHEET_SECRET) return j({error: 'not configured'}, 503);
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
      return j({error: 'request failed: ' + e.message}, 502);
    }
  }
};
