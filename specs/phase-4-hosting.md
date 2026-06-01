# Spec: Phase 4 — Hosting & Mainland-China Delivery

**Status:** Research-first; recommendation gated on data collection
**Owner:** TBD
**Depends on:** Phase 2 (site builds on modern Node, produces static `public/`)
**Estimated effort:** ~0.5 day research + ~0.5 day implementation once a decision is made

---

## 1. Context

TechFusionFM is a static Hexo site for a Chinese-language tech podcast. A meaningful share of the audience is in mainland China, where network conditions are shaped by the Great Firewall (GFW), peering congestion, and the lack of an ICP filing (备案) for foreign-hosted sites.

The site historically ran on Linode. This phase decides where the rebuilt static site and its audio assets should live so that:
- Listeners in mainland China get acceptable latency and reliability
- Diaspora / global listeners get fast delivery
- We avoid (or consciously accept) the ICP-filing burden
- Feed URLs stay stable so no subscriber loses the show

This is a **decision-and-implementation** spec. The decision is data-gated: do not pick a host on vibes. Collect the numbers in §6, then choose per §7.

## 2. Goal

The site and its audio are served from a host (or split of hosts) that gives mainland-China listeners acceptable real-world performance, with feed URLs unchanged, at a cost the owner signs off on.

## 3. Non-goals

- No feed URL changes (`/podcast.xml`, `/spotlight.xml`, `/gadgets.xml` stay put — see §5).
- No content or design changes (those are Phases 2/3).
- Not committing to an ICP filing in this spec — that's a flagged decision point, not a default.
- No dynamic backend — the site is and stays static.

## 4. Constraints

- **Feed stability is absolute.** Podcast clients (Apple Podcasts, Xiaoyuzhou/小宇宙, Spotify, etc.) key on the feed URL and per-item GUIDs. A redirect chain is acceptable *only* if it's a permanent 301 that every major client follows; an outright URL change is not.
- **Static output only.** Whatever Phase 2 produces in `public/` is the entire deployable surface.
- **Audio is the heavy payload.** `/audio/*.mp3` dwarfs the HTML. The cost and latency calculus is dominated by audio egress, not page weight.
- **No assumption of ICP.** Default posture is "serve mainland acceptably *without* filing." ICP is only on the table if the data says it's necessary and the owner opts in.

## 5. Feed URL preservation (the load-bearing constraint)

Current canonical feed URLs:
- `https://TechFusionFM.com/podcast.xml`
- `https://TechFusionFM.com/spotlight.xml`
- `https://TechFusionFM.com/gadgets.xml`

And the enclosure media base (from `_config.yml`):
- `media_base_url: https://TechFusionFM.com/` → audio served as `https://TechFusionFM.com/audio/<file>.mp3`

Whatever hosting topology is chosen, these URLs must resolve. If audio moves to a separate CDN origin, the cleanest path is to keep `TechFusionFM.com/audio/*` as the public URL and have it proxy/redirect to the audio POP behind the scenes — **not** to rewrite `media_base_url` to a new hostname, which would change every enclosure URL in the feed.

> ⚠️ If `media_base_url` is changed, every episode's `<enclosure url=>` changes. Some clients treat that as a new episode; others break the download. Avoid.

## 6. Research to collect (do this before choosing)

Capture results in `verification/hosting-research.md`. Each item needs a number or a documented answer, not a guess.

### 6.1 Mainland reachability of the status quo
- Current GFW status of `TechFusionFM.com` (test from mainland vantage points — e.g. a checker service, or a contact on the ground)
- Current GFW status of the legacy Linode origin IP
- Whether the apex domain currently resolves + loads from mainland at all

### 6.2 Latency / loss to candidate POPs from mainland
Measure (or source published numbers) from mainland vantage points (Beijing, Shanghai, Guangzhou, plus a non-tier-1 city if possible) to:
- Cloudflare (Hong Kong POP)
- Bunny.net (Asia POPs — HK / SG / TYO)
- Vercel (Tokyo / `hnd1`)
- Linode (Tokyo, Singapore)
- (Optional) a domestic-friendly CDN that doesn't require ICP for the apex but accelerates statics

For each: median RTT, packet loss, and TTFB for a representative audio file.

### 6.3 Audience split
- % of listens from mainland vs. diaspora vs. global. Pull from whatever analytics exist (feed host stats, Apple Podcasts Connect, Xiaoyuzhou dashboard). This number drives how hard to optimize for mainland.

### 6.4 ICP feasibility (only if §6.1–6.3 say mainland delivery is poor and audience is mainland-heavy)
- What ICP filing actually requires now (entity, hosting-in-CN, timeline)
- Whether a *mainland mirror* (HTML + feeds only, audio still offshore) is viable without filing the whole domain
- Cost + ongoing compliance burden

## 7. Decision framework

Pick the topology based on what §6 returns:

| If the data shows… | Then lean toward… |
|---|---|
| Apex reachable from mainland, latency tolerable, audience mostly diaspora | **Single global CDN** (Cloudflare Pages / Vercel). Simplest. Done. |
| Apex reachable, but audio is slow/lossy from mainland, audience meaningfully mainland | **Split:** HTML+feeds on global CDN, `/audio/*` proxied to an Asia POP (Bunny.net HK/SG or Linode Tokyo) — feed URLs unchanged per §5 |
| Apex GFW-blocked or unreliable, audience mainland-heavy | Escalate to owner: **ICP-filed mainland mirror** for HTML/feeds + offshore audio, or accept degraded mainland delivery |
| Audience almost entirely diaspora/global | Don't over-engineer — global CDN, skip the Asia split |

The "split HTML/audio" option is the pragmatic favorite going in, but only the data justifies it.

## 8. Implementation (once topology is chosen)

### 8.1 Single global CDN path
- Connect repo to Cloudflare Pages (or Vercel); build command `npx hexo generate`, output dir `public/`
- Point `TechFusionFM.com` apex + `www` at the host
- Verify all three feeds + audio resolve over the new host
- Set up branch previews for PRs

### 8.2 Split path (additional steps)
- Stand up audio origin on the chosen Asia POP, sync `public/audio/*` there
- Configure `TechFusionFM.com/audio/*` to proxy to that origin (CDN rule / Worker / redirect) so public URLs and thus enclosure URLs are unchanged
- Confirm range requests (HTTP 206) work through the proxy — podcast clients seek, and broken range support breaks scrubbing
- Document the audio-sync step so future episode uploads land in both places

### 8.3 Common
- DNS cutover plan with low-TTL pre-change
- Keep the old origin warm until feeds verify on the new host
- Add deploy step to the Phase 2 GitHub Actions workflow (build → deploy on merge to `main`)

## 9. Verification

- [ ] All three feed URLs resolve over the new host, XML byte-identical to pre-cutover (modulo build date)
- [ ] Every `<enclosure url=>` still points at a working, range-request-capable audio URL
- [ ] One full episode downloads + scrubs correctly in Apple Podcasts and Xiaoyuzhou
- [ ] Mainland vantage test: home page + one audio file load in acceptable time (define "acceptable" from §6.2 numbers)
- [ ] Diaspora/global vantage test: fast as before or better
- [ ] DNS propagation clean; old origin can be retired
- [ ] CI deploy step green on merge to `main`

## 10. Acceptance criteria

- [ ] `verification/hosting-research.md` populated with real numbers for §6.1–6.3 (and 6.4 if triggered)
- [ ] Topology decision documented with the data that justified it
- [ ] Feeds resolve, enclosures intact, range requests work
- [ ] Mainland + global vantage checks pass
- [ ] Auto-deploy on merge wired up
- [ ] `PLAN.md` Phase 4 section updated with the decision and outcome

## 11. Risks

- **GFW status is non-deterministic and changes over time.** A host that's fast today can be throttled tomorrow. Favor providers with multiple Asia POPs and easy origin-swap over a single fixed IP.
- **Range-request breakage on the audio proxy** silently breaks scrubbing without breaking playback start — easy to miss in a quick test. Explicitly verify 206 responses.
- **Changing `media_base_url`** would rewrite every enclosure URL. Treat as forbidden unless a deliberate, client-tested migration.
- **ICP filing is a heavy, slow, entity-level commitment.** Don't let it sneak in as a default; surface it as an explicit owner decision.
- **Apex-domain CDN restrictions in China:** many domestic-friendly CDNs won't accelerate an un-filed apex. The split topology sidesteps this by keeping the apex offshore and only optimizing audio delivery.

## 12. Deliverable

- `verification/hosting-research.md` (the data + the decision)
- Host configuration (Pages/Vercel project, or split CDN setup) — documented in `docs/hosting.md`
- Updated GitHub Actions workflow with deploy step
- `PLAN.md` Phase 4 updated
- DNS change log / runbook for the cutover

## 13. Followups (not this phase)

- CDN cost monitoring / alerting on audio egress
- Per-region analytics to refine the audience split over time
- Re-evaluate ICP if mainland audience grows materially
