# TechFusionFM Reboot Plan

Working plan for the show reboot and site rewrite. Phases are independently shippable.

## Phase 1 — Foundation & housekeeping ✅

Low-risk cleanup to get the repo into a sane working state before the rewrite. Shipped in PR #1.

- [x] Fix `hi@TchFusionFM.com` typo in `_config.yml`
- [x] Refresh `README.md` (drop dead `hits.dwyl.io` badge, document current state honestly)
- [x] Remove Snyk (`.snyk`, snyk-protect lifecycle hook, snyk dep) — references a 2018 lodash patch via a dep no longer in the tree
- [x] Archive `telebot/` to `archive/telebot/` — not part of the site build
- [x] Remove empty `bash-wakatime/` directory
- [x] Tidy `.gitignore`
- [x] Add CI build workflow — done in Phase 2 once the stack installed on modern Node

## Phase 2 — Stack modernization ✅

Spec: `specs/phase-2-stack-modernization.md`. Decision: stay on Hexo (7.x) rather than migrate SSGs — minimizes migration surface, keeps theme customizations.

- [x] Node 22 LTS baseline (`engines.node`, `.nvmrc`), drop `npm` from deps
- [x] Audit vendored plugins — both patched; podcast generator patches are load-bearing for feed format (`vendor/PATCHES.md`)
- [x] Relocate vendored plugins to `vendor/`, reference via `file:` deps
- [x] Hexo 3.8 → 7.x + plugin swaps; kept `hexo-generator-index2` (upgraded to 0.2.0) because mainline never gained the load-bearing `include: tag podcast` filter
- [x] Port Anatole theme Jade → Pug (13 templates); rendered-output diff vs. jade@1.11 ground truth
- [x] Pin feed GUID construction to Hexo 3 semantics (Hexo ≥5 lowercases permalink hosts — would have changed every GUID)
- [x] Feed parity verified vs. `backup-rss.xml`: 45/12/4 items, GUIDs + enclosures byte-identical
- [x] GitHub Actions build workflow (`.github/workflows/build.yml`)

Remaining before merge: owner spot-check of rendered pages; production-feed diff at merge time.

## Phase 3 — Design refresh

Pinned. Separate exercise underway for visual style.

## Phase 4 — Hosting (research collected, decision blocked on owner data)

Spec: `specs/phase-4-hosting.md`. Research: `verification/hosting-research.md`.

- [x] GFW/DNS status: apex resolves cleanly from 5 mainland vantage points to Linode Tokyo origin (DNS-level; HTTP-level check still owner action)
- [x] POP latency: secondary-source table compiled (Cloudflare HK, Bunny.net Asia, Vercel TYO, Linode TYO/SGP)
- [x] ICP requirements documented (2–6 weeks with CN entity, 3–6 months without; offshore-enclosure mirror question needs paid consult)
- [ ] **Owner action:** audience split (mainland vs. diaspora %) from Apple Podcasts Connect / Xiaoyuzhou / Spotify dashboards — the decision matrix keys on this
- [ ] **Owner action:** HTTP-level + latency tests from a real mainland vantage point
- [ ] Topology decision per spec §7, then implementation

Pragmatic split still the leading candidate: HTML on a global CDN, heavy audio (`/audio/*.mp3`) on an Asia-POP CDN, feed URLs unchanged.
