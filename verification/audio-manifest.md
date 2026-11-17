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
- **5 episodes carried a stale `<enclosure length>` — fixed 2026-11-17.** The feed's declared length (driven by post front matter) had drifted from the actual file:

  | ep | file bytes (repo/live) | old feed `<enclosure length>` | status |
  |---:|---:|---:|---|
  | 1 | 126,178,859 | 126,178,382 | fixed (manifest size; file is server-only) |
  | 4 | 97,828,450 | 93,917,681 | fixed |
  | 16 | 82,912,850 | 82,826,554 | fixed |
  | 34 | 20,756,244 | 20,693,629 | fixed |
  | 41 | 21,253,615 | 43,877,942 | fixed |

  The `length` front matter of posts 1, 4, 16, 34 and 41 now equals the real byte size (`stat` on `source/audio/*.mp3`; for ep 1, whose file is gitignored and server-only, the size recorded in `audio-manifest.tsv`). Post 41 had also inherited post 40's length **and** `duration` (01:30:30); its duration is now `00:43:22`, from `ffprobe` on `source/audio/41.mp3` (2602.19 s). GUIDs and enclosure URLs were not touched. The `declared_len_matches` column in the TSV records the state at generation time (2026-07-12); after this fix all 45 declared lengths match.

  This was a pre-existing production quirk, never a migration regression, and it was cosmetic: `<enclosure length>` is a size hint, and clients key on `<guid>` (and sometimes the enclosure URL), both stable.

## Regenerating

```sh
# rebuild feeds first so declared lengths are current
npx hexo clean && npx hexo generate
# then re-run the manifest script (backs up server-only files + hashes all 45)
```
