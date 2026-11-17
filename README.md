# TechFusionFM

Source for [TechFusionFM.com](https://TechFusionFM.com), the site and RSS feeds of 《科技聚变》(TechFusion), a Chinese-language podcast about the internet and the people who make it. One build produces the website and three podcast feeds:

| Show | Feed | Items |
|---|---|---|
| 科技聚变 (all episodes) | [`/podcast.xml`](https://TechFusionFM.com/podcast.xml) | 45 |
| 聚焦 (Spotlight) | [`/spotlight.xml`](https://TechFusionFM.com/spotlight.xml) | 12 |
| 小玩意儿 (Gadgets) | [`/gadgets.xml`](https://TechFusionFM.com/gadgets.xml) | 4 |

The show is relaunching. The plan is in [PLAN.md](./PLAN.md), and the owner's launch runbook is in [docs/launch.md](./docs/launch.md).

## Stack

- [Hexo](https://hexo.io) 7.3, static output in `public/`
- Node 22 (pinned in [`.nvmrc`](./.nvmrc) and `engines`)
- Theme: a customized [Anatole](https://github.com/hi-caicai/farbox-theme-Anatole), ported to Pug (`themes/anatole/`). The sidebar's show links and social icons come from `shows:` and `social:` in [`themes/anatole/_config.yml`](./themes/anatole/_config.yml).
- Two patched plugins are vendored in `vendor/` and installed via `file:` dependencies. The feed generator's patches affect feed output; see [vendor/PATCHES.md](./vendor/PATCHES.md) before you touch them.

## Local development

```sh
nvm use               # Node 22
npm ci
npm run build         # hexo generate -> public/
npm run server        # preview on http://localhost:4000
npm run check:feeds   # feed parity + directory-requirements gate (run after build)
```

`check:feeds` ([`tools/check-feeds.mjs`](./tools/check-feeds.mjs)) fails if any published `<guid>`, `<link>` or enclosure URL changes, compared with [`verification/backup-rss.xml`](./verification/backup-rss.xml) and [`verification/feed-baseline.json`](./verification/feed-baseline.json). It also fails if required iTunes or Podcast Index tags are missing, or if the artwork is not a square image of 1400–3000 px. CI runs it on every push.

Standalone Node scripts go in `tools/`, not `scripts/`, because Hexo loads every file in `scripts/` as a plugin.

## Publishing an episode

1. `npx hexo new post <N>` creates `source/_posts/<N>.md` from [`scaffolds/post.md`](./scaffolds/post.md). The filename becomes the permalink (`/<N>/`) and the feed `<guid>`, so keep it as the episode number. Then change `title:` to the real episode title.
2. Fill in the front matter:
   - `title`: shown without the `#N:` prefix, which the feed adds
   - `subtitle`: becomes the feed `<description>`
   - `date`
   - `tags: podcast`
   - `categories: spotlight` or `categories: gadgets` for those shows (leave it out for the main show)
   - `media: audio/<N>.mp3`
   - `length`: the exact byte size, from `stat -c %s`
   - `media_type`
   - `duration`: `HH:MM:SS`
3. Write the show notes, including chapters (`#### 章节：`), in the body.
4. Put the MP3 in `source/audio/<N>.mp3`. Files over 100 MB can't go into git, so upload those to the server by hand.
5. `npm run build && npm run check:feeds`, then commit and merge to `master`.

**Never change an existing permalink, `<guid>`, or enclosure URL.** Podcast apps identify episodes by them, so a changed value shows up as a duplicate or a missing episode for every subscriber. The feed check enforces this.

## Deploy

[`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) runs on every push to `master` (or manually). It builds the site, runs `check:feeds`, and then rsyncs `public/` over SSH to the nginx docroot on the Linode Tokyo server.

- Required secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` and `DEPLOY_PATH`.
- Optional secrets: `DEPLOY_PORT` (default 22) and `DEPLOY_KNOWN_HOSTS` (recommended; pins the server's host key).
- Setup steps are in [docs/launch.md §0](./docs/launch.md#0-blockers-owner-do-first).
- **Audio is never deleted or overwritten.** The site sync excludes `audio/`. A separate step uploads only MP3s that don't exist on the server yet, using `--ignore-existing` and no `--delete`.
- `1.mp3`, `2.mp3` and `22.mp3` are over 100 MB, so they are gitignored and **exist only on the server**. See [verification/audio-manifest.md](./verification/audio-manifest.md) for backups and hashes.

Hosting options for the longer term (CDN, mainland China delivery) are in [docs/hosting.md](./docs/hosting.md).

## Monitoring

- [`.github/workflows/build.yml`](./.github/workflows/build.yml) builds the site and runs the feed check on every push and on PRs to `master`.
- [`.github/workflows/tls-watch.yml`](./.github/workflows/tls-watch.yml) runs weekly and fails if the TLS certificate expires within 21 days or the chain doesn't validate. GitHub emails the repository owner when a run fails.

## Repository map

| Path | What |
|---|---|
| `source/` | Posts (`_posts/`), pages (`faq/`, `donate/`, `404.md`), audio |
| `themes/anatole/` | Theme (Pug templates, CSS, sidebar config) |
| `scaffolds/` | Front-matter template for `hexo new` |
| `vendor/` | Vendored, patched Hexo plugins; see [PATCHES.md](./vendor/PATCHES.md) |
| `tools/` | Standalone scripts: `check-feeds.mjs`, `refresh-post-links.mjs` |
| `docs/` | Owner-facing docs: [launch.md](./docs/launch.md), [hosting.md](./docs/hosting.md) |
| `specs/` | Phase specs ([phase 2](./specs/phase-2-stack-modernization.md), [phase 4](./specs/phase-4-hosting.md)) |
| `verification/` | Baselines and research: production feed snapshot, feed baseline, audio manifest, hosting research |

## Credits

- CMS: [Hexo](https://hexo.io)
- Theme: based on [Anatole](https://github.com/hi-caicai/farbox-theme-Anatole)
- Telegram bot, custom deployment script, show notes, custom XML parser, theme customization: [Jerry Fengwei Zhang](https://github.com/JerryFZhang)

## License

Everything under `source/` is licensed under [Creative Commons 4.0 BY-NC-ND](https://creativecommons.org/licenses/by-nc-nd/4.0/). Everything else is under the [MIT License](https://opensource.org/license/mit).

> Note: the [`LICENSE`](./LICENSE) file in this repository currently contains the Apache License 2.0 text, which does not match the MIT statement above. The owner needs to decide which one is correct and update the other.

All textual content, images, logos and audio on [TechFusionFM.com](https://TechFusionFM.com) are exclusively owned by TechFusionFM.com unless otherwise authorized.

<a rel="license" href="https://creativecommons.org/licenses/by-nc-nd/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc-nd/4.0/88x31.png" /></a>
