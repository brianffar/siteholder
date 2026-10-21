# Siteholder site – notes for Claude

Static site for Siteholder Records. This repo is public (GitHub Pages): keep private notes out of it. Full project notes live in the claude.ai Project "Siteholder Website".

- Repo: brianffar/siteholder, branch main. Push to main deploys to https://siteholderrecords.com (GitHub Pages + Cloudflare). Tell Brian to hard refresh (Cmd+Shift+R) after pushes.
- Commit messages end with the Co-Authored-By and Claude-Session lines. Commit and push before ending a session. Use a wip branch for anything not ready to go live.
- Everything is in index.html (hash router, no build). Release data is embedded JSON. route() ends with enhanceSearch(); initCarousel(); fitHero();
- Home carousel: We're Back -> Latest release -> Featured artist; auto-rotates every 8s. Artists page uses FEATURED + FEAT_IMG; carousel uses HOME_ARTISTS.
- admin/ holds the private tools (all behind one Cloudflare Access rule on /admin): admin/social (reel and image generator), admin/previews (Preview Clipping Tool), admin/health (Catalog Health; media-manifest.json is a hand-refreshed list of reel/image URLs from the sheet for its R2 check), admin/calendar (Posting Calendar; reads admin/calendar/schedule-snapshot.json, a hand-refreshed copy of the Master Sheet Avery tab). The old /social and /previews are redirect stubs. go/ is the public smart link pages (edit go/links.json, then run python3 go/build.py: it rebuilds go/ and refreshes the STORE-LINKS block in index.html).
- Audio and media are on Cloudflare R2 (audio.siteholderrecords.com); the sandbox cannot reach it.
- Brian wants direct step-by-step instructions. Mockup first, then approval, then push; small content edits can be pushed directly.
