# Hosting — Options & Open Decision

**Status:** Decision OPEN. Owner input required.
**Last updated:** 2026-07-09
**Spec:** [`specs/phase-4-hosting.md`](../specs/phase-4-hosting.md) · **Research:** [`verification/hosting-research.md`](../verification/hosting-research.md)

This is the deliverable named in spec §12. It does **not** pick a host — spec §7's decision matrix keys on an audience-split number the owner has not yet supplied. It records what was measured, which candidates are eliminated and why, and the two or three that remain live.

---

## 0. P0 — the site is currently down for real podcast clients

This is not a hosting *choice*; it is an outage, and it outranks everything else in this document.

Measured from this machine on **2026-07-09** against the live origin (`172.104.88.68`, Linode Tokyo):

| Check | Result |
|---|---|
| Apex TLS certificate | **Expired `2023-04-17`** (`openssl x509 -checkend 0` fails) |
| Chain validation | Fails — `Verify return code: 21 (unable to verify the first certificate)`; issuer `Let's Encrypt R3`, long retired |
| SAN extension | Absent — CN-only cert (pre-2023 style) |
| `https://TechFusionFM.com/` (strict TLS) | `000` — connection not established |
| `https://TechFusionFM.com/podcast.xml` (strict) | `000` |
| `https://TechFusionFM.com/audio/45.mp3` (strict) | `000` |
| Same three URLs with `curl -k` | `200`, `200`, `206` — content is intact and Range works |
| `http://TechFusionFM.com/podcast.xml` | `301` → `https://…` — **no plaintext fallback** |

The cert has been expired for **1,179 days**. Apple Podcasts, Overcast, Pocket Casts and 小宇宙 all validate TLS, and `http://` redirects into the broken HTTPS, so there is no path by which a conforming client can fetch the feed or download an episode. The bytes are fine; the transport is not.

**Every hosting option below fixes this as a side effect.** The cheapest fix is independent of all of them:

```sh
# on the existing Linode Tokyo box
sudo certbot --nginx -d TechFusionFM.com -d www.TechFusionFM.com
sudo systemctl list-timers | grep certbot   # confirm auto-renew is armed
```

Cost: $0. Changes: none — no URL, no GUID, no topology. Do this first, decide topology after.

> Note: a 3-year expiry means renewal was almost certainly never automated, rather than having silently failed. Whatever host is chosen, verify the renewal timer exists and alert on cert age.

---

## 1. Constraints any option must satisfy

Carried from spec §4–§5, plus what was measured on 2026-07-09.

1. **Feed URLs unchanged** — `https://TechFusionFM.com/{podcast,spotlight,gadgets}.xml`.
2. **Enclosure URLs unchanged** — `https://TechFusionFM.com/audio/N.mp3`. Changing the host or path re-downloads the catalog for every subscriber.
3. **Apex served** (not just `www`), because both of the above are apex URLs.
4. **HTTP Range / `206`** on audio — podcast clients seek. The current origin serves `206` correctly.
5. **~2.5 GB audio catalog**, individual files up to **136.9 MB**.
6. **No ICP filing** (备案) today; part of the audience is in mainland China.

### 1.1 Catalog facts that constrain the choice

Measured against the repo and the live origin:

- `podcast.xml` encloses **45** episodes. The repo contains **43** MP3s.
- `source/audio/{1,2,22}.mp3` are **absent from the repo and explicitly `.gitignore`d** — they are **120.3 MB / 136.9 MB / 111.6 MB**, over GitHub's 100 MB per-file hard limit. They exist **only on the live Linode box**, where all three currently return `206`.
- `source/audio/0.mp3` exists in the repo but is enclosed by no feed (likely a trailer). Harmless.
- Enclosure `length` attributes match real byte counts (spot-check: `45.mp3` = `36,351,712` B in the feed, on disk, and on the server).

> ⚠️ **Migration hazard.** Any cutover that publishes only what is in this repo will 404 episodes **1, 2 and 22** for existing subscribers. Either keep pulling `/audio/*` from the live Linode origin, or retrieve those three files from the box before uploading elsewhere. Verify all 45 enclosure URLs return `200`/`206` after any cutover.

---

## 2. Eliminated candidates

### Cloudflare Pages — excluded by owner directive
Not evaluated as a target. Retained here only to record that spec §7/§8.1 previously named it as the default path; those sections have been corrected.

### GitHub Pages — **not viable**
- Published site is hard-capped at **1 GB**; the catalog is ~2.5 GB. ([GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), accessed 2026-07-09)
- Git rejects files **over 100 MB**, so `1.mp3`, `2.mp3` and `22.mp3` *can never be committed* — the gitignore already reflects this.
- **100 GB/month** soft bandwidth limit; one 50 MB episode × ~2,000 downloads exhausts it. GitHub's own documented remedy is "put a CDN in front… or move to a different hosting service."
- Range/`206` on Pages is **not guaranteed by any official doc** — inferred from Fastly behaviour only, with a community-reported range bug on compressed responses.

Apex + auto-TLS work fine; the audio is the disqualifier, and audio cannot be split off without moving it to another hostname (violating constraint 2).

### Vercel — **not viable**
- The Acceptable Use Policy (last updated **2026-04-21**) prohibits using the platform to **"host media for hot-linking"**. RSS enclosures are, definitionally, hot-linked media. Serving `/audio/N.mp3` from a Vercel deployment sits permanently on the wrong side of the AUP.
- Vercel's blessed alternatives (Blob, external CDN) place audio on a **different hostname**, which violates constraint 2.
- No mainland PoP; Vercel's own KB states it "cannot guarantee availability or performance within mainland China." `*.vercel.app` is DNS-poisoned/SNI-blocked (custom domains avoid that specific block).

### Tencent EdgeOne — **not viable without Enterprise**
Worth stating explicitly, because it is the option most likely to be picked by mistake:

> EdgeOne's no-ICP **"Global availability zone (excluding Chinese mainland)"** does not route mainland users to overseas PoPs — it **returns HTTP `401` to mainland network environments by design**. Binding a custom domain does not bypass it; the block is tied to the availability zone.

So on EdgeOne's affordable plans (Personal/Basic/Standard), mainland listeners get an error, not slow audio. Genuine no-ICP mainland reach requires the **Enterprise-only Cross-MLC-border** add-on at ~$0.57/GB *on top of* ~$0.10/GB — cost-prohibitive for 50–137 MB files at any real download volume.

---

## 3. Live options

None of these is chosen. All three keep every feed and enclosure URL byte-identical.

### Option A — Fix TLS on the existing Linode Tokyo box (zero-migration baseline)

Run certbot; change nothing else.

| | |
|---|---|
| **Cost** | $0 on top of the current Linode plan |
| **Fixes** | The outage (§0). Restores all clients, all feeds, all audio. |
| **Does not fix** | Mainland performance. Single Tokyo origin on the China Telecom 163 backbone — secondary benchmarks put peak-hour Tokyo-from-mainland at ~280–385 ms with ~6.8 % loss (see research §6.2). No CDN, no redundancy. |
| **Risk** | Reintroduces the same failure mode if renewal is not automated and monitored. |

This is the correct **first** action regardless of which topology wins. It is listed as an option because it may also be a sufficient *final* answer if the audience turns out to be diaspora-heavy.

### Option B — Bunny.net fronting the apex, path-routed audio origin *(repo's standing favourite)*

One edge in front of the apex; `/audio/*` routed by Edge Rule to a separate origin (the Linode box, or Bunny Storage).

| | |
|---|---|
| **Cost** | Pay-as-you-go. Asia Standard **$0.03/GB**; Volume tier from **$0.005/GB**. $1/month minimum. No bandwidth cap. |
| **ToS** | Checked: Bunny's AUP contains **no bandwidth cap and no prohibition on serving on-demand podcast audio**. This is a material differentiator over the free-CDN tiers, whose media clauses bite. |
| **Apex** | Supported via CNAME flattening in Bunny DNS — or any ALIAS/ANAME-capable DNS provider. You are not forced onto Bunny DNS. |
| **URL stability** | Preserved. Path-based origin override (Edge Rules → *Change Origin URL*, wildcard trigger) keeps `/audio/N.mp3` on the apex. |
| **Mainland** | 27 Asia PoPs (HK, Tokyo, Singapore, Taipei, Seoul) but **no mainland PoP**. Cross-firewall best-effort — better than a single Tokyo VPS, not a solved problem. |
| **TLS** | Free auto-renewing Let's Encrypt on custom hostnames. |

> ⚠️ **Range/`206` caveat — verify before cutover.** Bunny serves `206` by default for **cached** content only. For **uncached** content — i.e. the first play of any episode, and after any purge or eviction — byte-range support requires enabling **"Optimize for Video Delivery"**, which is **off by default**. That feature pulls the origin in 5 MB chunks (the origin must itself support Range), and Bunny warns it "can reduce overall throughput when delivering large uncached files" and is "not efficient for non-video based content." A 137 MB MP3 is exactly that case.
>
> **Test it on `2.mp3` (136.9 MB), not on a small file**, with a cold cache: `curl -r 0-100 -o /dev/null -w '%{http_code}'` must return `206`.

### Option C — Alibaba Cloud DCDN, "Global (Excluding Chinese Mainland)"

The only vendor found whose **no-ICP** configuration actually *serves* mainland users rather than blocking them.

| | |
|---|---|
| **Mainland** | Per Alibaba's primary doc: for "Global (Excluding Chinese Mainland)", **no ICP is required** and "Requests from the Chinese mainland are routed to PoPs in Japan, Singapore, or Hong Kong (China)" — served, not 401'd. |
| **URL stability** | Preserved (CDN fronting; apex resolvable via authoritative DNS). |
| **Range/`206`** | **Not established** from fetched docs for this specific configuration. Must be verified before committing. |
| **Cost** | Not modelled — needs the egress number from §4. |
| **Friction** | Alibaba Cloud International account, PRC-vendor relationship, console in mixed zh/en. |

---

## 4. What blocks the decision

Unchanged from research §6.3 — and it is **owner-gated**, not analysis-gated:

1. **Audience split (mainland % vs diaspora %)** — the pivot number for spec §7. Sources: Apple Podcasts Connect → Analytics → Listeners by region; 小宇宙 creator portal; Spotify for Podcasters; and the Linode `access_log` grouped by geolocated client IP for `/audio/*.mp3`. *(~30 min.)*
2. **Mainland HTTP-level reachability + latency**, once TLS is fixed. ITDOG / boce from Beijing, Shanghai, Guangzhou + one non-tier-1 city, off-peak and 20:00–23:00 Beijing time, against the apex and one audio file. *(~1 hr.)*

Until (1) exists, no row of spec §7's matrix can honestly be selected.

**Note on §6.1's "owner action: run an HTTP-level test":** that action is now partly discharged — the HTTP-level test was run on 2026-07-09 and the answer is that HTTPS fails for *everyone*, mainland or not, because of §0. Re-run the mainland-specific tests only after the cert is fixed; results taken before then measure nothing but the expired cert.

---

## 5. Suggested sequence

1. **Fix the cert** (Option A's action). Unblocks every subscriber today; commits to nothing.
2. Confirm all 45 enclosures return `200`/`206` over valid TLS.
3. Pull the audience split (§4.1). *~30 min of dashboard reading.*
4. Re-run mainland reachability now that TLS works (§4.2).
5. Then, and only then, choose between A (stay put), B (Bunny) and C (Alibaba DCDN) per spec §7.
6. Whatever is chosen: retrieve `1.mp3`, `2.mp3`, `22.mp3` from the Linode box before any origin change, and re-verify all 45 enclosures after cutover.

---

## 6. Confidence & residual uncertainty

- **HIGH** — the §0 TLS outage and the §1.1 catalog facts. Directly measured on 2026-07-09; reproducible with the commands shown.
- **HIGH** — GitHub Pages 1 GB / 100 MB / 100 GB limits; Vercel's AUP hot-linking clause; EdgeOne's mainland `401`; Alibaba DCDN's no-ICP mainland routing. All from current primary vendor documentation.
- **MEDIUM** — Bunny pricing and PoP list (live vendor pages, 2026); Bunny's uncached-Range behaviour (vendor support articles, undated; one was `403` to automated fetch and is quoted from a search snippet).
- **LOW** — every mainland latency figure in research §6.2. All secondary, none specific to this site. Do not plan against them.
- **NOT ESTABLISHED** — Bunny's `206` behaviour on a first-request cache miss from an *external* origin; Range/`206` on Alibaba DCDN's no-ICP zone; this show's actual monthly egress, so no option's real monthly bill can be computed.
