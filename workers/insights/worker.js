/* Siteholder IG Insights Worker.
   Route: siteholderrecords.com/admin/api/insights*   (sits behind the Cloudflare Access rule on /admin/*)
   Secret: IG_TOKEN (Instagram access token). KV binding: INSIGHTS (follower history + refreshed token).
   Cron: daily, saves the follower count and refreshes the token when it is old. */
const API = 'https://graph.instagram.com/v21.0';
const TZ = 'America/Chicago';
const day = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });
const unix = (ms) => Math.floor(ms / 1000);

async function token(env) { return (await env.INSIGHTS.get('token')) || env.IG_TOKEN; }

async function ig(path, params, tok) {
  const u = new URL(API + path);
  Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, v));
  u.searchParams.set('access_token', tok);
  const r = await fetch(u);
  const j = await r.json();
  if (!r.ok || j.error) throw new Error((j.error && j.error.message) || 'HTTP ' + r.status);
  return j;
}
const safe = async (errs, name, fn) => { try { return await fn(); } catch (e) { errs[name] = String(e.message || e); return null; } };

async function saveFollowers(env, count) {
  const h = JSON.parse((await env.INSIGHTS.get('followers')) || '{}');
  h[day(Date.now())] = count;
  await env.INSIGHTS.put('followers', JSON.stringify(h));
  return h;
}

async function refreshToken(env) {
  const at = Number((await env.INSIGHTS.get('tokenAt')) || 0);
  if (Date.now() - at < 20 * 864e5) return;
  const u = new URL('https://graph.instagram.com/refresh_access_token');
  u.searchParams.set('grant_type', 'ig_refresh_token');
  u.searchParams.set('access_token', await token(env));
  const j = await (await fetch(u)).json();
  if (j.access_token) { await env.INSIGHTS.put('token', j.access_token); await env.INSIGHTS.put('tokenAt', String(Date.now())); }
}

async function build(env) {
  const tok = await token(env), errs = {};
  const now = Date.now(), until = unix(now), since7 = unix(now - 7 * 864e5), since28 = unix(now - 28 * 864e5);
  const profile = await ig('/me', { fields: 'username,followers_count,follows_count,media_count' }, tok);
  const followers = await saveFollowers(env, profile.followers_count);
  const totals = (since) => ig('/me/insights', { metric: 'views,reach,accounts_engaged,total_interactions,profile_links_taps', metric_type: 'total_value', period: 'day', since, until }, tok)
    .then((j) => Object.fromEntries(j.data.map((m) => [m.name, m.total_value.value])));
  const [w7, w28, reachDaily, media] = await Promise.all([
    safe(errs, 'last7', () => totals(since7)),
    safe(errs, 'last28', () => totals(since28)),
    safe(errs, 'reachDaily', () => ig('/me/insights', { metric: 'reach', period: 'day', since: since28, until }, tok).then((j) => j.data[0].values.map((v) => ({ d: day(v.end_time), v: v.value })))),
    safe(errs, 'media', () => ig('/me/media', { fields: 'id,caption,media_product_type,permalink,thumbnail_url,media_url,timestamp', limit: '50' }, tok).then((j) => j.data)),
  ]);
  const reels = await Promise.all((media || []).filter((m) => m.media_product_type === 'REELS').slice(0, 30).map(async (m) => {
    const e = {};
    const main = await safe(e, 'm', () => ig('/' + m.id + '/insights', { metric: 'views,reach,likes,comments,shares,saved,ig_reels_avg_watch_time' }, tok));
    const skip = await safe(e, 's', () => ig('/' + m.id + '/insights', { metric: 'reels_skip_rate' }, tok));
    const g = (r, n) => { const x = r && r.data.find((d) => d.name === n); return x ? x.values[0].value : null; };
    return { id: m.id, cap: (m.caption || '').split('\n')[0], url: m.permalink, thumb: m.thumbnail_url || m.media_url, date: day(m.timestamp), views: g(main, 'views'), reach: g(main, 'reach'), likes: g(main, 'likes'), comments: g(main, 'comments'), shares: g(main, 'shares'), saves: g(main, 'saved'), watch: g(main, 'ig_reels_avg_watch_time'), skip: g(skip, 'reels_skip_rate') };
  }));
  const demo = {};
  await Promise.all(['country', 'city', 'age', 'gender'].map((b) => safe(errs, 'demo_' + b, () =>
    ig('/me/insights', { metric: 'follower_demographics', period: 'lifetime', metric_type: 'total_value', breakdown: b }, tok).then((j) => {
      const r = j.data[0].total_value.breakdowns[0].results.map((x) => ({ k: x.dimension_values[0], v: x.value })).sort((a, c) => c.v - a.v);
      demo[b] = r;
    }))));
  return { fetchedAt: new Date().toISOString(), profile, followers, last7: w7, last28: w28, reachDaily, reels, demo, errors: errs };
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (!req.headers.get('cf-access-jwt-assertion')) return new Response('Forbidden', { status: 403 });
    const cache = caches.default, key = new Request(url.origin + '/admin/api/insights-cache');
    if (!url.searchParams.has('refresh')) { const hit = await cache.match(key); if (hit) return hit; }
    let body;
    try { body = JSON.stringify(await build(env)); }
    catch (e) { return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 502, headers: { 'content-type': 'application/json' } }); }
    const res = new Response(body, { headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=600' } });
    ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  },
  async scheduled(ev, env, ctx) {
    ctx.waitUntil((async () => {
      const tok = await token(env);
      const p = await ig('/me', { fields: 'followers_count' }, tok);
      await saveFollowers(env, p.followers_count);
      await refreshToken(env);
    })());
  },
};
