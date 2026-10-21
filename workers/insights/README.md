# IG Insights Worker
Serves /admin/api/insights for the admin Insights page. No secrets in this repo.
Setup (Cloudflare dashboard): Workers & Pages > Create > Worker, paste worker.js. Settings > Variables: secret IG_TOKEN. Bindings: KV namespace INSIGHTS. Triggers: route siteholderrecords.com/admin/api/insights* and a daily cron (0 11 * * *).
The Cloudflare Access rule on /admin/* must cover /admin/api/* (the Worker refuses requests without the Access header).
