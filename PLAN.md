# TechFusionFM Reboot Plan

Working plan for the show reboot and site rewrite. Phases are independently shippable.

## Phase 1 — Foundation & housekeeping ✅ (in progress)

Low-risk cleanup to get the repo into a sane working state before the rewrite.

- [x] Fix `hi@TchFusionFM.com` typo in `_config.yml`
- [x] Refresh `README.md` (drop dead `hits.dwyl.io` badge, document current state honestly)
- [x] Remove Snyk (`.snyk`, snyk-protect lifecycle hook, snyk dep) — references a 2018 lodash patch via a dep no longer in the tree
- [x] Archive `telebot/` to `archive/telebot/` — not part of the site build
- [x] Remove empty `bash-wakatime/` directory
- [x] Tidy `.gitignore`
- [ ] Add CI build workflow — **deferred to Phase 2** (current Hexo 3.8 chain doesn't install on modern Node; CI would just fail)

## Phase 2 — Stack decision & rewrite

Open questions:

- **Stack:** Astro vs. Hexo 7.x upgrade vs. Eleventy. Tradeoffs documented in chat — decision pending.
- **Vendored `node_modules`:** `hexo-renderer-marked/` and `hexo-generator-multiple-podcast/` are committed (likely patched). Resolve as part of the stack swap — either upstream the patches or replace the functionality.
- **RSS feed parity:** `/podcast.xml`, `/spotlight.xml`, `/gadgets.xml` URLs and item GUIDs must stay stable so existing subscribers don't lose the show.

## Phase 3 — Design refresh

Pinned. Separate exercise underway for visual style.

## Phase 4 — Hosting

Open question: how to serve the mainland China audience without ICP filing, post-Linode-era. Research needed:

- Real latency/loss numbers from mainland vantage points to candidate POPs (Cloudflare HK, Bunny.net Asia, Vercel TYO, Linode TYO/SGP).
- Current GFW status of `TechFusionFM.com` and the Linode origin IP.
- Decision on whether to ICP-file a mainland mirror for fast in-CN delivery.
- Audience split: % of listens from mainland vs. diaspora (drives the calculus).

Pragmatic split under consideration: HTML on a global CDN (Cloudflare Pages / Vercel), heavy audio (`/audio/*.mp3`) on a separate Asia-POP CDN (Bunny.net / Linode Tokyo), feed URLs unchanged.
