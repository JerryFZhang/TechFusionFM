# Audio manifest & backup

**Generated:** 2026-07-12 · **Data:** [`audio-manifest.tsv`](./audio-manifest.tsv)

A byte + SHA-256 inventory of every episode enclosed by the three feeds. Its job is to be the **cutover baseline**: after any host or origin change, re-hash the served files against this table to prove every subscriber gets the same bytes.

## Why this exists

`podcast.xml` encloses 45 episodes; the repo tracks only 43 MP3s. `source/audio/{1,2,22}.mp3` are `.gitignore`d because they are **111–137 MB**, over GitHub's 100 MB per-file limit, so they live **only on the Linode Tokyo origin** — a single point of failure with, until fixed, a broken TLS cert.

Those three files are now backed up (see below), and all 45 enclosures are hashed here.

## Backup location

The three server-only episodes were pulled from the live origin (over `curl -k`, since the cert is expired) to:

```
~/Documents/GitHub/TechFusionFM-audio-backup/{1,2,22}.mp3   (~369 MB, off-repo)
```

Sizes match the feed's live `Content-Length`. **This is a local backup on one machine — it still needs a durable home** (object storage, or committed to a Git LFS / release asset once a host is chosen). Do not treat a single local copy as safe storage.

## Findings

- **43 in-repo files: repo bytes == live server bytes** (spot-checked via `Content-Length`). The repo audio is faithful to production; a rebuild-based cutover serves identical bytes.
- **Built feed `<enclosure length>` == live production feed for all 45.** No length changes are introduced by the Hexo 7 build. (GUID + enclosure URL identity was verified separately — that is what podcast clients dedup on.)
- **5 episodes carry a stale `<enclosure length>`** — the feed's declared length differs from the actual file:

  | ep | file bytes (repo/live) | feed `<enclosure length>` |
  |---:|---:|---:|
  | 1 | 126,178,859 | 126,178,382 |
  | 4 | 97,828,450 | 93,917,681 |
  | 16 | 82,912,850 | 82,826,554 |
  | 34 | 20,756,244 | 20,693,629 |
  | 41 | 21,253,615 | 43,877,942 |

  This is a **pre-existing production quirk** (the length attribute is driven by post frontmatter, which drifted from the re-encoded files), present in the live feed today — **not** introduced by any migration. It is **cosmetic**: `<enclosure length>` is a size hint, and no mainstream podcast client dedups or re-downloads on it — they key on `<guid>` (and, in some clients, the enclosure URL), both of which are stable. Clients read the true size from the server's `Content-Length` at download time.

  Optional cleanup, not required for cutover: correct the `length` in the five episodes' frontmatter so the feed self-describes accurately. Harmless to subscribers either way.

## Regenerating

```sh
# rebuild feeds first so declared lengths are current
npx hexo clean && npx hexo generate
# then re-run the manifest script (backs up server-only files + hashes all 45)
```
