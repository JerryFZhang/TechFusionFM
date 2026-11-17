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
- [x] Feed parity verified vs. `verification/backup-rss.xml`: 45/12/4 items, GUIDs + enclosures byte-identical
- [x] GitHub Actions build workflow (`.github/workflows/build.yml`)

Merged in PR #3.

## Phase 3 — Design refresh

Deferred until after relaunch; launch on current Anatole look (cleanup only).

## Relaunch

Launch kit and owner runbook: [`docs/launch.md`](docs/launch.md). Mirrors its blocking items.

### Repo-side (done on `claude/relaunch-residuals`)

- [x] `security: remove archived telebot (leaked token)` — token still in git history; revocation is an owner item below
- [x] `feed: modernize podcast tags without touching GUIDs` — itunes:type/episode/title, podcast:guid/locked/funding, explicit=false, categories
- [x] `content: fix stale enclosure lengths`
- [x] `content: refresh boilerplate links in posts`
- [x] `theme: single config-driven subscribe sidebar` — `shows:` / `social:` in `themes/anatole/_config.yml`
- [x] `site: real pages for faq/donate/404/thanks`
- [x] `theme: head metadata & bug fixes`
- [x] `cleanup: remove dead theme/config/deps residue`
- [x] `assets: re-export show artwork as RGB, optimized PNG`
- [x] `ci: feed parity gate, TLS watch, deploy` — `npm run check:feeds`, `tls-watch.yml`, `deploy.yml`
- [x] `docs: README, PLAN, spec status, launch kit`

### Owner — blocking (docs/launch.md §0–1)

- [ ] Revoke the leaked Telegram bot token (BotFather `/revoke`)
- [ ] Renew TLS on the Linode box (`certbot --nginx`), confirm the renewal timer
- [ ] Durable off-server backup of `1.mp3`, `2.mp3`, `22.mp3`
- [ ] Deploy user + SSH key; add `DEPLOY_*` GitHub secrets
- [ ] nginx: `error_page 404 /404.html;`, `/faq/` and `/donate/` serve `index.html`
- [ ] Merge the relaunch PR; deploy run green; all three feeds + an mp3 range request pass over strict TLS
- [ ] Feeds pass an external validator (Podcast Index / Cast Feed Validator)

### Owner — directories & launch (docs/launch.md §2–5)

- [ ] Apple Podcasts: relist all three shows (currently delisted), update `shows.*.links.apple` if IDs change
- [ ] Spotify, YouTube, Amazon, Podcast Index, 小宇宙, 喜马拉雅, 网易云, 荔枝 — submit / claim, fill `shows.*.links.*`
- [ ] Social handles audit; unified bio; link-in-bio → `/faq/`
- [ ] "We're back" episode #46 and launch-day posting matrix

## Phase 4 — Hosting (options documented, decision blocked on owner data)

Spec: `specs/phase-4-hosting.md`. Research: `verification/hosting-research.md`. Options: `docs/hosting.md`.

### 🚨 P0 — production TLS certificate expired 2023-04-17

Discovered 2026-07-09. The apex serves a cert that expired 2023-04-17 (still expired as of 2026-11-13), with a broken chain, and `http://` 301s into it. **Strict-TLS podcast clients — Apple Podcasts, Overcast, Pocket Casts, 小宇宙 — cannot fetch the feed or any episode.** The bytes are fine (`curl -k` returns `200` on the feeds and `206` on audio); only the transport is broken.

- [ ] **Owner action (P0):** `sudo certbot --nginx -d TechFusionFM.com -d www.TechFusionFM.com` on the Linode box; confirm the renewal timer. $0, no URL/GUID change, unblocks every subscriber.
- [ ] Then verify all 45 enclosure URLs return `200`/`206` over valid TLS.

This is independent of stack and topology, and it outranks everything below.

Once fixed, `.github/workflows/tls-watch.yml` checks the certificate weekly (fails, and GitHub emails the owner, within 21 days of expiry or on an invalid chain) so this cannot recur silently.

### Research & options

- [x] GFW/DNS status: apex resolves cleanly from 5 mainland vantage points to Linode Tokyo origin
- [x] HTTP-level check run (2026-07-09) — see P0 above; mainland tests are meaningless until the cert is fixed
- [x] POP latency: secondary-source table compiled (Bunny.net Asia, Vercel TYO, Linode TYO/SGP)
- [x] ICP requirements documented (2–6 weeks with CN entity, 3–6 months without; offshore-enclosure mirror question needs paid consult)
- [x] Deploy options vetted and written up in `docs/hosting.md`; Cloudflare Pages excluded by owner directive, GitHub Pages / Vercel / non-Enterprise EdgeOne ruled out on evidence
- [ ] **Owner action:** audience split (mainland vs. diaspora %) from Apple Podcasts Connect / Xiaoyuzhou / Spotify dashboards — the decision matrix keys on this
- [ ] **Owner action:** mainland HTTP + latency tests — *after* the cert fix
- [ ] Topology decision per spec §7, then implementation

Three live options, none chosen: **(A)** fix TLS and stay on Linode Tokyo; **(B)** Bunny.net fronting the apex with `/audio/*` path-routed to an Asia POP (the standing favourite); **(C)** Alibaba Cloud DCDN's no-ICP "Global (excluding mainland)" zone — the only no-ICP config found that serves mainland users rather than returning `401`.

> ⚠️ `source/audio/{1,2,22}.mp3` are `.gitignore`d (111–137 MB, over GitHub's 100 MB file limit) and live **only on the Linode box**. Any repo-only cutover 404s those three episodes.
