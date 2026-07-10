# Phase 4 Hosting Research — Data Collection

**Date collected:** 2026-07-02
**Scope:** Spec `specs/phase-4-hosting.md` §6.1–6.4 (research only — no hosting decision is made in this document).
**Method note:** All measurements below are either (a) remote lookups run on 2026-07-02 from this environment, or (b) published secondary sources with dates. No measurements were taken from inside mainland China; site-specific mainland HTTP tests remain an owner/contact action.

---

## §6.1 Mainland reachability of the status quo

### Findings

**ViewDNS Chinese Firewall Test, run 2026-07-02** — tool URL (re-runnable by owner):
`https://viewdns.info/chinesefirewall/?domain=TechFusionFM.com`

| Mainland vantage point | DNS result | Status |
|---|---|---|
| Beijing | 172.104.88.68 | OK |
| Shenzhen | 172.104.88.68 | OK |
| Inner Mongolia | 172.104.88.68 | OK |
| Heilongjiang Province | 172.104.88.68 | OK |
| Yunnan Province | 172.104.88.68 | OK |

ViewDNS summary verbatim: "All servers were able to reach your site. This means that your site should be accessible from within mainland China."

**Origin identity (checked 2026-07-02):**
- `TechFusionFM.com` A record: `172.104.88.68`; AAAA record: `2400:8902::f03c:91ff:fee7:12ca`
- Both IPs geolocate to **Tokyo, JP — AS63949 Akamai Connected Cloud (Linode)** per ipinfo.io (2026-07-02). Reverse DNS on the A record is `techfusionfm.com`.
- Conclusion: the legacy origin is a **Linode Tokyo** instance and is currently the live origin. No CDN in front (DNS points straight at the VPS).

### Confidence limits — read before relying on this

- **This is DNS-level evidence, not HTTP-level.** The ViewDNS test demonstrates that mainland resolvers return the correct, unpoisoned IP (GFW DNS poisoning typically returns bogus IPs; a consistent correct answer from 5 provinces is a good sign). It does **not** prove that TCP/443 connections to 172.104.88.68 complete, that TLS/SNI is unmolested, or that throughput is usable for 50+ MB audio files.
- GFW interference is frequently applied at the SNI/IP/throughput layer while DNS stays clean, and it varies by ISP, province, and time of day (evening peak congestion on the China Telecom 163 backbone is a distinct, non-GFW problem).
- Complementary tools the owner can re-run (all free, no signup):
  - ViewDNS Chinese Firewall Test: `https://viewdns.info/chinesefirewall/?domain=TechFusionFM.com` (DNS from 5 mainland cities)
  - Comparitech GFW checker: `https://www.comparitech.com/privacy-security-tools/blockedinchina/` (HTTP fetch attempt from a mainland vantage)
  - ITDOG (Chinese-language, HTTP + ping from many mainland ISP/province combos): `https://www.itdog.cn/http/`
  - Ping.pe / boce.com — mainland multi-ISP ping and traceroute to `172.104.88.68`

**Confidence: HIGH** that DNS resolves cleanly from mainland (verified twice — by the prior research pass and re-verified 2026-07-02, same 5/5 result, same IP).
**Confidence: LOW** on actual page-load/audio-download experience from mainland — untested at HTTP level from a mainland vantage.

**Owner action:** run an HTTP-level test (ITDOG or a contact on the ground) against `https://TechFusionFM.com/` and one representative `/audio/*.mp3` file, ideally on China Telecom + China Unicom + China Mobile, once off-peak and once during the 20:00–23:00 Beijing-time peak.

### ⚠️ Update 2026-07-09 — HTTP-level test run; the apex is down for all strict-TLS clients

The HTTP-level check above was run (from a US vantage, not mainland). It does not measure the GFW, because it never gets that far: **the apex TLS certificate expired on 2023-04-17** — 1,179 days ago.

| Check | Result |
|---|---|
| `openssl x509 -checkend 0` | fails — **expired** `notAfter=Apr 17 06:02:02 2023 GMT` |
| Chain validation | `Verify return code: 21 (unable to verify the first certificate)`; issuer `Let's Encrypt R3` (retired) |
| SAN | absent (CN-only cert, `CN=techfusionfm.com`) |
| `https://TechFusionFM.com/`, `/podcast.xml`, `/audio/45.mp3` (strict TLS) | `000`, `000`, `000` |
| same three with `curl -k` | `200`, `200`, `206` (Range works; bytes intact) |
| `http://TechFusionFM.com/podcast.xml` | `301` → `https://…` — no plaintext fallback |

Apple Podcasts, Overcast, Pocket Casts and 小宇宙 all validate TLS, so **no conforming podcast client has been able to fetch this feed since 2023-04-17.**

Consequences for this document:
- The §6.1 mainland-reachability question is **moot until the cert is fixed**. Any mainland test run before then measures the expired cert, not the GFW.
- The §6.2/§6.3 owner actions should be **re-sequenced after** the cert fix, not before.
- This is independent of hosting topology and of the site's SSG. Remediation: `certbot --nginx` on the existing Linode box, then confirm the auto-renew timer. See [`docs/hosting.md`](../docs/hosting.md) §0.

**Confidence: HIGH** — directly measured, reproducible with the commands above.

---

## §6.2 Latency / loss to candidate POPs from mainland

> **All numbers in this section are secondary sources** (published benchmarks and dated blog measurements), **not site-specific measurements**. They indicate order-of-magnitude expectations only. Real numbers for this site require mainland vantage tests (owner action, §6.1 tools).

| Candidate | Published latency from mainland | Source + date | Notes |
|---|---|---|---|
| **Cloudflare (free/pro plans)** | Mainland traffic is generally routed to **US West PoPs (LAX/SJC), not Hong Kong**, on non-Enterprise plans → ~160–200 ms baseline to US West from Shanghai; community reports of ~200 ms degrading to 1000+ ms on China Unicom to free-plan IP ranges | Cloudflare China Network docs (`developers.cloudflare.com/china-network/faq/`, current 2026); Server.HK optimization guide, 2026-04-17; Cloudflare Community threads #191423, #846064 (latter returned HTTP 403 to our fetcher — cited from search snippet only, treat as weak) | True in-mainland PoPs require **Enterprise plan + China Network (JD Cloud) + ICP filing**. HK PoP serving mainland users is not guaranteed on cheap plans. |
| **Cloudflare HK PoP (when actually routed there)** | HK standard BGP from Shanghai: **40–80 ms**; HK CN2 GIA: **20–35 ms** | Server.HK guide, 2026-04-17 (numbers are for HK-located servers generally, not Cloudflare-specific) | Routing to HK from mainland on non-Enterprise Cloudflare is inconsistent; treat 40–80 ms as best case, not typical. |
| **Bunny.net Asia (HK/TYO Volume tier)** | No published mainland-specific ms figures found. Bunny claims "up to 90% reduced latency" for the Tokyo Volume PoP vs prior routing; Japan peering with SoftBank/NTT DOCOMO/KDDI/OPTAGE/BIGLOBE | bunny.net blog "High Volume CDN Tier Expands to Tokyo and Hong Kong", **published 2023-02-22** (`bunny.net/blog/expanding-volume-tier-to-tokyo-and-hong-kong/`) | ⚠️ **Correction to prior research pass:** this expansion is dated **Feb 2023, not Jan 2025**. Bunny has no mainland-China PoPs; mainland users hit HK/TYO over GFW egress like any offshore CDN. Mainland ms figures: unknown, owner action needed. |
| **Vercel (Tokyo / `hnd1`)** | No usable published ms figures; qualitative evidence is negative: `*.vercel.app` is **DNS-poisoned and SNI-blocked** in mainland; custom domains work but Vercel has no mainland nodes and its own KB recommends a static mirror with "more reliable routing into China" | Vercel KB "Accessing Vercel-hosted sites from mainland China" (current 2026); github.com/vercel/community discussions #803, #806; 21YunBox/21Cloudbox guides (2024–2025) | Custom domain avoids the `.vercel.app` block, but edge routing from mainland is reported slow/unreliable. Mainland ms figures: unknown. |
| **Linode Tokyo (current origin)** | **~71 ms** ping (single Jan-2024 community benchmark, vantage/carrier not fully specified); LowEndTalk consensus: DigitalOcean/Vultr/Linode ride the China Telecom **163 backbone** → "horrible to all 3 main carriers at night"; generic-transit Tokyo/SG routes measured at **~280–385 ms average with 6.8% peak-hour packet loss** from Changchun (China Telecom) in Feb–Mar 2026 | jakejarvis/datacenter-speed-tests (Jan 2024); LowEndTalk thread #154566; dev.to "CN2 GIA vs Regular VPS" real-data test, 2026-03 (tested Vultr Tokyo as the "regular 163" proxy, not Linode specifically) | The 71 ms figure and the 280–385 ms figure are both "Tokyo from China" — the spread **is** the finding: off-peak good-route vs peak-hour 163-backbone are different worlds. |
| **Linode Singapore** | Generic-transit Singapore from Changchun: **~312 ms avg (298–385 ms range)**, same test as above; Server.HK table: Singapore-to-Shanghai baseline **60–120 ms** on decent routes | dev.to CN2 GIA comparison, 2026-03; Server.HK guide, 2026-04-17 | Same caveat: neither number is Linode-specific. |
| **Reference point: CN2 GIA Tokyo** (premium-routed, e.g. BandwagonHost) | **95 ms avg (88–105 ms)**, 0.3% peak packet loss | dev.to CN2 GIA comparison, Feb 20–Mar 1 2026, Changchun/China Telecom, 100 pings × 3/day | Included as the "what good looks like" baseline, not a candidate. |

**Attempted but unavailable:** CDNPerf's China RUM ranking (`cdnperf.com/#!performance,China`) is JavaScript-rendered and returned no data to our fetcher; the owner can view it live in a browser — it ranks CDN providers by real-user latency within China, updated hourly.

**Confidence: MEDIUM** on the qualitative picture (Cloudflare non-Enterprise routes mainland to US West; Vercel is degraded; 163-backbone peak congestion dominates any Tokyo/SG VPS). **Confidence: LOW** on any specific ms number applying to this site's users.

**Owner action:** run ITDOG/boce ping+HTTP from Beijing/Shanghai/Guangzhou + one non-tier-1 city against (a) current origin 172.104.88.68, (b) a Bunny.net test URL, (c) a Cloudflare-proxied test hostname — off-peak and 20:00–23:00 Beijing time — and record median RTT, loss %, and TTFB for one audio file. This is ~1 hour of work and converts this whole section from secondary to primary data.

---

## §6.3 Audience split (mainland vs diaspora vs global)

**Status: Owner action required — data is owner-gated.** No public source can answer this; it lives only in authenticated owner dashboards:

1. **Apple Podcasts Connect** → Analytics → Listeners by country/region (`podcastsconnect.apple.com`)
2. **Xiaoyuzhou (小宇宙) creator portal** — mainland-native client; its subscriber/play counts are a direct proxy for the mainland audience (`podcaster.xiaoyuzhoufm.com`)
3. **Spotify for Podcasters** → Audience → location breakdown (`podcasters.spotify.com`) — note Spotify is unavailable in mainland, so this measures the diaspora/global side
4. **RSS host / server access-log stats** — the feeds are self-hosted on the Linode box (per `_config.yml`, feeds at `/podcast.xml`, `/spotlight.xml`, `/gadgets.xml`, media under `media_base_url: https://TechFusionFM.com/`), so nginx/Apache access logs for `/audio/*.mp3` grouped by client IP geolocation are the most complete single source: they capture every client and every mainland platform (Xiaoyuzhou etc. fetch server-side, so also note *platform-crawler* IPs vs *end-listener* IPs when interpreting)

**Why this is flagged as the single biggest decision blocker:** spec §7's decision matrix branches almost entirely on this one number — "mostly diaspora" → single global CDN; "meaningfully mainland" → split topology; "mainland-heavy + poor reachability" → escalate to ICP discussion. Every other section of this document is refinement; without the audience split, no row of the §7 matrix can be selected.

**Owner action:** pull last-90-day listener geography from the four sources above; record mainland %, diaspora %, and per-platform totals into this file.

**Confidence: N/A (no data).** Do not guess this number.

---

## §6.4 ICP feasibility (2026 requirements)

### Who can file
- ICP filing (备案/Beian) requires a **mainland Chinese legal entity or a Chinese-resident individual with mainland ID**. Foreign companies cannot file directly; they need an onshore vehicle (WFOE, JV, or a sponsoring Chinese partner). *(Sources: msadvisory.com ICP guide, 2026; TMO Group ICP guide, 2025; Alibaba Cloud ICP docs, current.)*
- Individual (个人) filings exist but are for personal non-commercial sites and are ISP-verified; a podcast with sponsorship could be pushed toward enterprise filing. Not resolved by public sources for this specific case.

### What's needed
- **Hosting physically in mainland China** with an accredited provider (Alibaba Cloud, Tencent Cloud, etc.) — filing is submitted through the host.
- **Domain registered at a Chinese-accredited registrar** — domains held at overseas registrars are rejected; `TechFusionFM.com` would need a registrar transfer (or a separate mirror domain would be filed instead).
- Entity license, legal-rep ID, real-name verification, and since ~2024–2025 an expected **data-handling plan** (PIPL / cross-border data-transfer rules).
- **PSB (Public Security Bureau) filing within 30 days** of receiving the ICP number.
- Filing itself is free; costs are the entity, hosting, and agent/consultant fees.

### Timeline (verifies the prior research pass's numbers)
- **With an existing Chinese entity:** ICP filing typically **2–6 weeks once documents are complete** (some sources: 20–60 working days) — consistent with the earlier "~6–8 weeks" figure.
- **Without an entity (from scratch):** **3–6 months total**, WFOE incorporation being the longest leg — matches the earlier figure.
- *(Sources: msadvisory.com "ICP License in China (2026)"; TMO Group 2025 guide; chinafy.com 2025 guide; appinchina.co ICP guide.)*

### The specific question: mainland mirror for HTML/feeds with offshore `<enclosure>` URLs
- **Partially answered by public sources.** ICP-filed mainland sites **may reference offshore resources** — there is no rule that every linked asset must be on-shore (filed sites routinely embed offshore scripts/media). Those offshore resources simply keep their offshore performance/blocking characteristics. *(Sources: chinafy.com "ICP license vs. no ICP license", 2025; Cloudflare China Network ICP docs.)* So the topology "on-shore HTML + feeds, offshore audio enclosures" does not appear to violate the filing regime per se.
- **Not answered by public sources, flag for paid consult:**
  1. Whether a **podcast** (regular audio programming) triggers the stricter **online audio-visual program rules (网络视听节目 regime / AVSP licence)** on top of plain Beian when the *pages and feeds* are on-shore — this licence is effectively unavailable to foreign-invested entities and would change the calculus entirely.
  2. Whether filing the existing apex `TechFusionFM.com` (registrar transfer + on-shore hosting for the apex) is compatible with keeping `media_base_url` offshore **at the same hostname path** (`TechFusionFM.com/audio/*` proxying offshore) — the interaction between "domain must be hosted in mainland" and "heavy paths proxy offshore" is not addressed in any source found.
  3. Content-review exposure: an ICP-filed site takes on mainland content-compliance obligations for everything it serves, including show notes and episode topics.
- **Owner action:** if §6.3 shows a mainland-heavy audience *and* §6.1 HTTP tests show poor delivery, commission a 1–2 hour paid consult (ICP filing agent or PRC counsel — e.g., via the filing desks at Alibaba Cloud/Tencent Cloud, or an agency like AppInChina/TMO) on points 1–3 above before any commitment. Per spec §4, no-ICP remains the default posture.

**Confidence: HIGH** on who-can-file / requirements / timeline (multiple consistent 2025–2026 sources). **Confidence: LOW** on the podcast-specific audio-visual-licence question and the same-hostname split question (unanswered publicly).

---

## Decision inputs: ready / not ready

| # | Input (feeds spec §7 matrix) | Status |
|---|---|---|
| 0 | **Apex serves valid TLS** | 🚨 **BLOCKING — cert expired 2023-04-17.** Fix before collecting #3/#4; see §6.1 update |
| 1 | Apex resolves un-poisoned from mainland (DNS level) | ✅ Ready — 5/5 vantage points, verified 2026-07-02 |
| 2 | Origin identity confirmed (Linode Tokyo, no CDN in front) | ✅ Ready |
| 3 | HTTP-level mainland reachability of apex + audio | ❌ Not ready — **blocked by #0**; any test before the cert fix measures the cert, not the GFW |
| 4 | Site-specific mainland latency/loss to candidate POPs | ❌ Not ready — only secondary benchmarks collected; **Owner action:** §6.2 vantage tests |
| 5 | Qualitative POP picture (Cloudflare non-Ent → US West; Vercel degraded; 163-backbone peak congestion) | ✅ Ready (medium confidence, secondary sources) |
| 6 | **Audience split mainland/diaspora** — the §7 pivot number | ❌ Not ready — **Owner action:** 4 dashboards (§6.3). *Biggest blocker.* |
| 7 | ICP requirements + timeline | ✅ Ready (high confidence) |
| 8 | Mainland-mirror-with-offshore-enclosures legality (podcast-specific) | ⚠️ Partial — general principle OK, podcast/AVSP question open; **Owner action:** paid consult only if triggered |

**Bottom line:** the §7 decision cannot responsibly be made yet. Blocking items are #6 (audience split — owner dashboards, ~30 min) and #3/#4 (mainland HTTP + latency tests, ~1 hour). Everything else is collected.

**But #0 outranks all of them.** The apex has served an expired certificate since 2023-04-17, so the show is currently unreachable to every strict-TLS podcast client. Fixing that is a `certbot` run, costs nothing, changes no URL or GUID, and is a prerequisite for #3 and #4 producing meaningful numbers. Do it before anything else in this document.
