#!/usr/bin/env python3
"""Builds the smart link pages. Run from anywhere:  python3 go/build.py

Reads the release data embedded in ../index.html and the store links in links.json,
then writes go/index.html (the hub), go/<release>/index.html (one smart link per
release) and go/<release>/<store>/index.html (tiny redirect pages: each store
button goes through one so Cloudflare Web Analytics counts the click by path).
It never touches index.html.
"""
import html, json, os, re, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SITE = 'https://siteholderrecords.com'
AUDIO = 'https://audio.siteholderrecords.com/'
IG = 'https://www.instagram.com/siteholderrecords/'
BEACON = ("<script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' "
          "data-cf-beacon='{\"token\": \"8818c4a270ca4d31b50a3cee9aa6625e\"}'></script>")

STORES = [('beatport', 'Beatport'), ('bandcamp', 'Bandcamp'), ('discogs', 'Vinyl on Discogs')]


def esc(s):
    return html.escape(str(s), quote=True)


def load():
    src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    rel = json.loads(re.search(r'id="releases">(.*?)</script>', src, re.S).group(1))
    links = json.load(open(os.path.join(HERE, 'links.json'), encoding='utf-8')).get('links', {})
    return rel, links


def art(r):
    return r.get('img') or r.get('labelImg') or 'og-image.jpg'


def buttons(r, lk):
    """list of (key, label, small, url) for the real store buttons on a release."""
    out = []
    urls = {'beatport': lk.get('beatport'), 'bandcamp': r.get('bandcamp'), 'discogs': lk.get('discogs')}
    for key, label in STORES:
        if urls.get(key):
            out.append((key, label, 'Open', urls[key]))
    for i, v in enumerate(lk.get('vinyl', [])):
        status = v.get('status', '')
        out.append(('vinyl-%d' % i, v['store'] + ' (vinyl)', status or 'Open', v['url']))
    return out


CSS = """
:root{color-scheme:light;--bg:#f2f3f4;--surface:#fff;--ink:#0e0f11;--muted:#5b5f66;--line:#d8dadd;--accent:#2536ff;--on-ink:#fff;--mono:ui-monospace,Menlo,Consolas,monospace;--display:'Helvetica Neue',Arial,sans-serif;--logo:url("/go/logo.png")}
@media(prefers-color-scheme:dark){:root{color-scheme:dark;--bg:#0e0f11;--surface:#17181b;--ink:#f1f2f3;--muted:#9b9fa7;--line:#2b2d32;--accent:#8a95ff;--on-ink:#0e0f11}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--display);padding:0 16px 48px}
a{color:inherit}
.wrap{max-width:460px;margin:auto;text-align:center}
.wide{max-width:1040px}
.logo{display:block;height:48px;aspect-ratio:480/272;margin:22px auto 18px;background-color:currentColor;-webkit-mask:var(--logo) no-repeat center/contain;mask:var(--logo) no-repeat center/contain}
.disc{width:min(72vw,300px);aspect-ratio:1;margin:0 auto 22px;border-radius:50%;background:var(--line) center/cover;box-shadow:0 24px 50px -24px rgba(0,0,0,.5);animation:sp 30s linear infinite}
.disc.sq{border-radius:2px;animation:none}
@keyframes sp{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.disc{animation:none}}
.cat{font:12px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
h1{font-size:34px;line-height:1;font-weight:800;text-transform:uppercase;letter-spacing:-.02em;margin:8px 0 6px;overflow-wrap:anywhere}
.by{font-size:18px}.sub{color:var(--muted);font-size:14px;margin-top:6px}
.btns{display:grid;gap:10px;margin:26px 0 24px}
.b{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px 18px;border:1.5px solid var(--ink);font-weight:700;font-size:16px;background:transparent;color:var(--ink);text-decoration:none;border-radius:2px;text-align:left}
.b:hover{background:var(--ink);color:var(--on-ink)}
.b.main{background:var(--ink);color:var(--on-ink)}.b.main:hover{background:var(--accent);border-color:var(--accent);color:#fff}
.b small{font:11px var(--mono);letter-spacing:.08em;text-transform:uppercase;opacity:.7;white-space:nowrap}
.tr{background:var(--surface);border:1px solid var(--line);text-align:left}
.tr div{display:flex;align-items:center;gap:12px;padding:11px 14px;border-bottom:1px solid var(--line);font-size:15px}.tr div:last-child{border-bottom:0}
.tr i{font:12px var(--mono);color:var(--muted);font-style:normal;width:16px}
.tr em{color:var(--muted);font-style:normal}
.tr button{margin-left:auto;flex:none;width:34px;height:34px;border-radius:50%;border:1.5px solid var(--ink);background:none;color:var(--ink);cursor:pointer;font-size:11px}
.tr button:hover,.tr button[aria-pressed=true]{background:var(--ink);color:var(--on-ink)}
.more{display:inline-block;margin-top:22px;font:12px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);text-decoration:none;border-bottom:1px solid currentColor}
.foot{margin-top:26px;display:flex;gap:18px;justify-content:center;flex-wrap:wrap}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px;margin:26px 0;text-align:left}
.t{display:block;text-decoration:none}.t img{display:block;width:100%;aspect-ratio:1;object-fit:cover;background:var(--line);border-radius:2px}
.t b{display:block;margin-top:8px;font-size:14px;line-height:1.2}.t span{display:block;font-size:13px;color:var(--muted)}
.t:hover b{color:var(--accent)}
.hero{display:grid;gap:18px;text-align:left;margin:8px 0 0;align-items:center}
@media(min-width:720px){.hero{grid-template-columns:260px 1fr;gap:32px}}
.hero img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:2px;background:var(--line)}
.h2{font:12px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:30px 0 0;text-align:left}
"""


def head(title, desc, url, image, extra=''):
    return ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<title>%s</title><meta name="description" content="%s"><link rel="canonical" href="%s">'
            '<meta property="og:type" content="website"><meta property="og:site_name" content="Siteholder Records">'
            '<meta property="og:title" content="%s"><meta property="og:description" content="%s">'
            '<meta property="og:url" content="%s"><meta property="og:image" content="%s">'
            '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="%s">'
            '<meta name="twitter:description" content="%s"><meta name="twitter:image" content="%s">'
            '<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">'
            '<link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="theme-color" content="#111111">'
            '%s<style>%s</style></head><body>') % (
        esc(title), esc(desc), esc(url), esc(title), esc(desc), esc(url), esc(image),
        esc(title), esc(desc), esc(image), extra, CSS)


def fmt_line(r, lk=None):
    f = 'Vinyl + digital' if (r.get('vinyl') or r.get('fmt') == 'Vinyl' or (lk or {}).get('discogs') or (lk or {}).get('vinyl')) else 'Digital'
    year = r['date'][:4]
    return '%s · %s · %s' % (r['cat'], f, year)


def release_page(r, lk):
    rid = r['id']
    url = '%s/go/%s/' % (SITE, rid)
    cover = '/' + r['img'] if r.get('img') else None
    disc = '/' + r['labelImg'] if r.get('labelImg') else None
    image = SITE + (cover or disc or '/og-image.jpg')
    title = '%s – %s' % (r['artist'], r['title'])
    desc = r.get('sub') or ('%s on Siteholder Records (%s).' % (r['title'], r['cat']))
    bt = buttons(r, lk)
    h = head(title + ' | Siteholder Records', desc, url, image, BEACON)
    h += '<div class="wrap"><a href="/go/" aria-label="Siteholder Records, all releases"><span class="logo" role="img" aria-label="siteHolder"></span></a>'
    if disc:
        h += '<div class="disc" style="background-image:url(%s)"></div>' % esc(disc)
    elif cover:
        h += '<div class="disc sq" style="background-image:url(%s)"></div>' % esc(cover)
    h += '<div class="cat">%s</div><h1>%s</h1><div class="by">%s</div>' % (esc(fmt_line(r, lk)), esc(r['title']), esc(r['artist']))
    if r.get('sub'):
        h += '<div class="sub">%s</div>' % esc(r['sub'])
    h += '<div class="btns">'
    for i, (key, label, small, _u) in enumerate(bt):
        h += '<a class="b%s" href="/go/%s/%s/" rel="nofollow">%s <small>%s</small></a>' % (
            ' main' if i == 0 else '', esc(rid), esc(key), esc(label), esc(small))
    if not bt:  # no store links yet: send them to the label site so the page is never a dead end
        h += '<a class="b main" href="%s/#release-%s">Listen on siteholderrecords.com <small>Open</small></a>' % (SITE, esc(rid))
    h += '</div>'
    tracks = [t for t in r['tracks'] if t.get('p')]
    if tracks:
        h += '<div class="tr" id="tr">'
        for i, t in enumerate(tracks):
            h += ('<div><i>%d</i><span>%s%s</span><button type="button" aria-pressed="false" aria-label="Play preview of %s" data-src="%s">&#9654;</button></div>'
                  % (i + 1, esc(t['t']), ' <em>(%s)</em>' % esc(t['m']) if t.get('m') and t['m'] != 'Original Mix' else '',
                     esc(t['t']), esc(AUDIO + t['p'])))
        h += '</div>'
    h += '<div class="foot"><a class="more" href="/go/">More from Siteholder &rarr;</a><a class="more" href="%s" target="_blank" rel="noopener">Instagram</a></div></div>' % IG
    if tracks:
        h += PLAYER
    h += '</body></html>'
    return h


PLAYER = """<script>
(function(){var a=new Audio(),cur=null;a.preload='none';
function off(){document.querySelectorAll('#tr button').forEach(function(b){b.innerHTML='&#9654;';b.setAttribute('aria-pressed','false')})}
a.addEventListener('ended',function(){off();cur=null});
document.querySelectorAll('#tr button').forEach(function(b){b.onclick=function(){
if(cur===b){a.pause();off();cur=null;return}
off();cur=b;a.src=b.dataset.src;a.play().catch(function(){});b.innerHTML='&#10074;&#10074;';b.setAttribute('aria-pressed','true')}})})();
</script>"""


def redirect_page(r, label, target):
    return ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<meta name="robots" content="noindex"><title>Opening %s</title>%s'
            '<style>body{font:16px Helvetica,Arial,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f2f3f4;color:#0e0f11}'
            '@media(prefers-color-scheme:dark){body{background:#0e0f11;color:#f1f2f3}}a{color:inherit}</style></head><body>'
            '<p>Opening %s&hellip; <a href="%s">Tap here if nothing happens</a></p>'
            '<script>setTimeout(function(){location.replace(%s)},450);</script>'
            '<noscript><meta http-equiv="refresh" content="0;url=%s"></noscript></body></html>'
            ) % (esc(label), BEACON, esc(label), esc(target), json.dumps(target), esc(target))


def hub(rels, links):
    rels = sorted(rels, key=lambda r: (r['date'], r['cat']), reverse=True)
    top = rels[0]
    h = head('Siteholder Records | Listen and buy', 'Every Siteholder Records release, with preview and store links.',
             SITE + '/go/', SITE + '/og-image.jpg', BEACON)
    h += '<div class="wrap wide"><a href="%s/" aria-label="Siteholder Records website"><span class="logo" role="img" aria-label="siteHolder"></span></a>' % SITE
    h += '<div class="h2">Latest release</div><a class="t hero" href="/go/%s/"><img src="/%s" alt="%s cover"><div>' % (
        esc(top['id']), esc(art(top)), esc(top['title']))
    h += '<div class="cat">%s</div><h1>%s</h1><div class="by">%s</div><div class="sub">%s</div>' % (
        esc(fmt_line(top, links.get(top['id']))), esc(top['title']), esc(top['artist']), esc(top.get('sub', '')))
    h += '<div class="btns"><span class="b main">Listen &amp; buy <small>Open</small></span></div></div></a>'
    h += '<div class="h2">All releases</div><div class="grid">'
    for r in rels[1:]:
        h += '<a class="t" href="/go/%s/"><img src="/%s" alt="" loading="lazy"><b>%s</b><span>%s</span></a>' % (
            esc(r['id']), esc(art(r)), esc(r['title']), esc(r['artist']))
    h += '</div><div class="foot"><a class="more" href="%s/">siteholderrecords.com</a><a class="more" href="%s" target="_blank" rel="noopener">Follow on Instagram</a></div></div></body></html>' % (SITE, IG)
    return h


def main():
    rel, links = load()
    for name in os.listdir(HERE):
        p = os.path.join(HERE, name)
        if os.path.isdir(p):
            shutil.rmtree(p)
    n = 0
    for r in rel:
        lk = links.get(r['id'], {})
        d = os.path.join(HERE, r['id'])
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(release_page(r, lk))
        for key, label, _s, target in buttons(r, lk):
            sd = os.path.join(d, key)
            os.makedirs(sd, exist_ok=True)
            open(os.path.join(sd, 'index.html'), 'w', encoding='utf-8').write(redirect_page(r, label, target))
            n += 1
    open(os.path.join(HERE, 'index.html'), 'w', encoding='utf-8').write(hub(rel, links))
    print('built %d release pages, %d store redirects, 1 hub' % (len(rel), n))


if __name__ == '__main__':
    main()
