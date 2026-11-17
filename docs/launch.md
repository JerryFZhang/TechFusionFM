# Relaunch kit

The owner's runbook for bringing 科技聚变 / 聚焦 / 小玩意儿 back online and back into podcast directories. The repo work is done; see the Relaunch section of [PLAN.md](../PLAN.md). Everything below needs access to the server, a directory account, or a social account.

Work top to bottom. §0 blocks everything else, and §1 must pass before any directory can see the feeds.

Placeholders: `TechFusionFM.com` is the production host. `<docroot>` is the nginx root that serves the site, which you'll confirm in §0.4.

---

## 0. Blockers (owner, do first)

### 0.1 Revoke the leaked Telegram bot token

The bot token for the old rank bot is in git history, in the deleted `archive/telebot/rank.py`. Rewriting history wouldn't help, because clones and forks already have it. Revoke it instead:

1. In Telegram, open **@BotFather** and send `/revoke`.
2. Pick the bot. BotFather issues a new token, and the old one stops working immediately.
3. If you still want the bot, put the new token in a secret store. Never commit it.

### 0.2 Renew TLS (P0)

The certificate expired on 2023-04-17 and was still expired as of 2026-11-13. Until this is fixed, Apple Podcasts, Overcast, Pocket Casts, 小宇宙 and every other strict-TLS client can't fetch anything. On the Linode box:

```sh
sudo certbot --nginx -d TechFusionFM.com -d www.TechFusionFM.com
systemctl list-timers | grep certbot         # a certbot timer must be listed
sudo certbot renew --dry-run                 # renewal works unattended
```

Check from any machine. Don't use `-k`:

```sh
curl -sSI https://TechFusionFM.com/podcast.xml | head -1      # HTTP/1.1 200 (or HTTP/2 200)
echo | openssl s_client -connect TechFusionFM.com:443 -servername TechFusionFM.com 2>/dev/null \
  | openssl x509 -noout -enddate -issuer
```

After that, [`tls-watch.yml`](../.github/workflows/tls-watch.yml) checks every Monday. It fails, and GitHub emails you, if the cert is within 21 days of expiry or the chain is invalid. You can also run it on demand from the Actions tab.

### 0.3 Durable backup of `1.mp3`, `2.mp3`, `22.mp3`

These three episodes (111–137 MB each) are over GitHub's file-size limit. Only two copies exist: one on the server and one on a single laptop (see [verification/audio-manifest.md](../verification/audio-manifest.md)). Copy them to durable storage, such as object storage or a GitHub Release asset on a private repo. Then check the SHA-256 of each copy against [`verification/audio-manifest.tsv`](../verification/audio-manifest.tsv).

### 0.4 Deploy user, SSH key, GitHub secrets

The deploy workflow ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)) rsyncs the built site over SSH. Set it up once.

1. **Find the docroot.** Look at the `root` directive for the `TechFusionFM.com` server block:

   ```sh
   sudo nginx -T 2>/dev/null | grep -nE 'server_name|root '
   ```

   This is `<docroot>`. For example, it might be `/var/www/html` if the old Apache layout was kept.
2. **Create a deploy user that owns the docroot:**

   ```sh
   sudo adduser --disabled-password --gecos '' deploy
   sudo chown -R deploy:deploy <docroot>
   ```

   nginx only needs read access, and the default `www-data` worker can read files that are `644`.
3. **Make a dedicated key pair.** Do this on your own machine, not on the server:

   ```sh
   ssh-keygen -t ed25519 -N '' -C 'github-deploy@TechFusionFM' -f ./techfusionfm_deploy
   ```

4. **Install the public key, restricted to rsync if possible.** On the server, add the key to `/home/deploy/.ssh/authorized_keys` (directory `700`, file `600`, owned by `deploy`). The safest form uses `rrsync`, which ships with rsync. Depending on the distro it is at `/usr/bin/rrsync` or `/usr/share/doc/rsync/scripts/rrsync`; check yours:

   ```
   command="/usr/bin/rrsync /",restrict ssh-ed25519 AAAA... github-deploy@TechFusionFM
   ```

   `rrsync` treats the remote path that rsync asks for as relative to its argument. The workflow sends `DEPLOY_PATH` as an absolute path and refuses `/`. So use one of these:

   - **Recommended:** `command="/usr/bin/rrsync /",restrict ssh-ed25519 …` with `DEPLOY_PATH=<docroot>`. The key can run only rsync, and the `deploy` user's file permissions limit what it can write.
   - **Simplest:** `restrict ssh-ed25519 …` with no `command=`, and `DEPLOY_PATH=<docroot>`. The key can then run any command as `deploy`.
5. **Capture the host key once, from a network you trust:**

   ```sh
   ssh-keyscan -t ed25519 TechFusionFM.com
   ```

6. **Add the GitHub secrets.** Go to *Settings → Secrets and variables → Actions → New repository secret*:

   | Secret | Value |
   |---|---|
   | `DEPLOY_HOST` | `TechFusionFM.com` (or the Linode IP) |
   | `DEPLOY_USER` | `deploy` |
   | `DEPLOY_SSH_KEY` | full contents of `./techfusionfm_deploy` (the private key) |
   | `DEPLOY_PATH` | `<docroot>`, absolute, no trailing slash |
   | `DEPLOY_PORT` | only if SSH is not on 22 |
   | `DEPLOY_KNOWN_HOSTS` | output of step 5. Optional, but strongly recommended. Without it, the workflow trusts whatever host key it sees on each run. |

   Then delete the local private key file, or move it to a password manager.
7. **Check for files the first deploy would delete.** The site sync uses `--delete-after`. It removes anything in `<docroot>` that isn't in the build, except `audio/` and `.well-known/`. Before the first deploy, look for files you want to keep:

   ```sh
   npm ci && npm run build
   rsync -rlzn --checksum --delete-after --exclude 'audio/' --exclude '.well-known/' \
     -e 'ssh -i ./techfusionfm_deploy' public/ deploy@TechFusionFM.com:<docroot>/ | grep '^deleting'
   ```

   (`-n` is a dry run.) Move anything you want to keep out of the docroot, or ask for an extra `--exclude` in `deploy.yml`.

### 0.5 nginx: 404 page and directory indexes

The site now has real `404.html`, `/faq/index.html` and `/donate/index.html`. Make sure the server block for `TechFusionFM.com` (and the `www` redirect, if any) contains:

```nginx
root <docroot>;
index index.html;
error_page 404 /404.html;

location / {
    try_files $uri $uri/ =404;
}
```

Then run `sudo nginx -t && sudo systemctl reload nginx`. Check the results:

- `curl -sSI https://TechFusionFM.com/faq/` should return `200`.
- `curl -sSI https://TechFusionFM.com/donate/` should return `200`.
- `curl -sS https://TechFusionFM.com/nope | grep -c 404` should be at least 1, and the response status should be `404`.

---

## 1. Deploy & verify

1. Merge the relaunch PR into `master`.
2. Watch the **Deploy** run under *Actions*. It builds, runs `check:feeds`, syncs, uploads any new audio, and smoke-tests the three feeds and one MP3 over strict TLS.
3. Check each feed by hand. Don't use `-k`:

   ```sh
   for f in podcast spotlight gadgets; do curl -sSI https://TechFusionFM.com/$f.xml | head -1; done
   curl -sS -o /dev/null -w '%{http_code}\n' -r 0-1023 https://TechFusionFM.com/audio/45.mp3   # expect 206
   curl -sS -o /dev/null -w '%{http_code}\n' -r 0-1023 https://TechFusionFM.com/audio/1.mp3    # server-only file, expect 206
   ```

4. Run the feed gate locally: `npm ci && npm run build && npm run check:feeds`.
5. Validate each feed URL with external validators:
   - [Cast Feed Validator](https://castfeedvalidator.com)
   - [Podbase validator](https://podba.se/validate/)
   - [Podcast Index](https://podcastindex.org), which also shows how the `podcast:` namespace tags are parsed

   Warnings about optional tags are fine. Errors are not.

---

## 2. Apple Podcasts: relist (important finding)

**As of 2026-11-17, all three shows are gone from Apple Podcasts:**

| Show | Apple ID | State |
|---|---|---|
| 科技聚变 | `1202658654` | lookup API returns 0 results; `podcasts.apple.com` 404; not in search |
| 聚焦 | `1381044925` | same |
| 小玩意儿 | `1381045277` | same |
| Artist (TechFusionFM.com) | `1383309099` | same |

The most likely cause is that Apple removed them because the feeds had been unreachable over TLS since 2023. Apple re-checks feeds periodically and drops shows that keep failing. Relisting has to wait until §0.2 and §1 pass.

Steps:

1. Sign in to [Podcasts Connect](https://podcastsconnect.apple.com) with the Apple Account that originally submitted the shows.
2. **If the shows are listed** (possibly with a status such as *Removed* or *Unavailable*), open each one. If it offers a feed refresh, re-enable or *Submit for Review*, use it on the **same feed URL**. Don't change the URL.
3. **If they aren't listed**, add each show as new using its existing feed URL:
   - `https://TechFusionFM.com/podcast.xml`
   - `https://TechFusionFM.com/spotlight.xml`
   - `https://TechFusionFM.com/gadgets.xml`

   Apple de-duplicates by feed URL, so this usually restores the original show and ID. That isn't guaranteed. If Apple says the feed belongs to another account, use the ownership-dispute path it offers.
4. Make sure `hi@TechFusionFM.com` receives mail. It's the `<itunes:email>` in every feed, and Apple and other directories may send verification to it.
5. After approval, look each show up at `https://itunes.apple.com/lookup?id=<ID>`.
   - **If the IDs are unchanged:** nothing to do. The sidebar already links `https://podcasts.apple.com/podcast/id<ID>`.
   - **If an ID changed:**
     - update `shows.<key>.links.apple` in [`themes/anatole/_config.yml`](../themes/anatole/_config.yml);
     - fix the `podcasts.apple.com/podcast/id…` links in posts and in [`source/faq/index.md`](../source/faq/index.md). [`tools/refresh-post-links.mjs`](../tools/refresh-post-links.mjs) is the pattern to copy: add a replacement rule for the old ID, run it with `--check`, then without.
   - Rebuild, run `check:feeds`, and deploy.

**`podcast:locked` and other directories.** Every feed now carries `<podcast:locked owner="hi@TechFusionFM.com">yes</podcast:locked>`. That tells hosting platforms not to import the feed without the owner's consent. Directories that only *read* the feed (Apple, Spotify, Podcast Index, Pocket Casts, Overcast) ignore it. A service that *imports* the show onto its own hosting may refuse while it is `yes`; some Chinese platforms' RSS import might behave this way, but that is unverified. If an import is refused for this reason:

1. In [`_config.yml`](../_config.yml), under the relevant `podcasts:` → `feed:` block, set `podcast_locked:` → `value: "no"`.
2. Build, run `check:feeds` (which accepts `yes` or `no`), and deploy.
3. Complete the import.
4. **Set it back to `"yes"`** and deploy again.

---

## 3. Other directories

After each listing is approved, add its URL to `shows.<key>.links.<platform>` in [`themes/anatole/_config.yml`](../themes/anatole/_config.yml) (`<key>` is `podcast`, `spotlight` or `gadgets`), then build and deploy. The sidebar hides empty links.

Processes change often. Rows marked **(check current process)** are based on how the platform last worked, not on a fresh verification.

| Platform | `links.` key | Submit / claim | What's needed | Notes |
|---|---|---|---|---|
| Spotify for Creators | `spotify` | [creators.spotify.com](https://creators.spotify.com): *Add an existing podcast* / *Find your show* → paste the RSS URL | Code sent to `<itunes:email>` (`hi@TechFusionFM.com`) | Spotify isn't available in mainland China. Useful for diaspora analytics (§6). |
| YouTube Studio (RSS ingestion → YouTube Music) | `youtube_music` | [studio.youtube.com](https://studio.youtube.com) → *Create* → *New podcast* → *Submit RSS feed* | A YouTube channel; RSS verification | **(check current process)** RSS ingestion has rolled out region by region. Confirm it's offered for your channel's country. |
| Amazon Music for Podcasters | `amazon` | [podcasters.amazon.com](https://podcasters.amazon.com) | Amazon account; RSS URL; email verification | **(check current process)** |
| Podcast Index | — | [podcastindex.org/add](https://podcastindex.org/add), then sign in and claim each feed | RSS URL | Feeds many open apps (AntennaPod, Podverse, Fountain, …). It may already index the feeds, so search first. |
| Pocket Casts | `pocketcasts` | Picked up automatically from Apple / Podcast Index; otherwise [pocketcasts.com/submit](https://pocketcasts.com/submit/) | RSS URL | Get the share link from the show page in the app. |
| Overcast | `overcast` | Automatic, through Apple | Apple listing (§2) | Link format `https://overcast.fm/itunes<AppleID>`. Set it after the Apple ID is confirmed. |
| 小宇宙 | `xiaoyuzhou` | Creator platform [podcaster.xiaoyuzhoufm.com](https://podcaster.xiaoyuzhoufm.com): claim the show by RSS | RSS verification, usually by email or a code; **may need a mainland phone number** | **(check current process)** 小宇宙 often indexes Apple-listed shows automatically, so search the app first. Its crawler fetches over strict TLS, so §0.2 is a prerequisite. |
| 喜马拉雅 | `ximalaya` | Creator center: RSS import, or reclaim the old album | Account and real-name verification; old album id **6648521** | **(check current process)** Try reclaiming album 6648521 before creating a new one. RSS import may run into `podcast:locked` (see §2). |
| 网易云音乐 播客 | `netease` | 网易云音乐 creator / 播客 center | Account; old djradio id **347498120** | **(check current process)** Try to recover djradio 347498120 first. |
| 荔枝 | `lizhi` | 荔枝 creator / 播客 import | Account; old id **1494013** | **(check current process)** Old show id 1494013. Decide whether it's worth maintaining. |

---

## 4. Social handles audit

The handles come from `social:` in [`themes/anatole/_config.yml`](../themes/anatole/_config.yml) and from [`source/faq/index.md`](../source/faq/index.md). For each row, log in, confirm you still control the account, and take the action listed.

| Platform | Handle / URL | Action | Bio |
|---|---|---|---|
| X | [@TechFusionFM](https://x.com/TechFusionFM) | Reclaim and update bio; pin the launch post | EN (or ZH) short |
| Instagram | [@TechFusionFM](https://instagram.com/TechFusionFM) | Reclaim and update bio; post the show artwork | EN + ZH short |
| Weibo | [@TechFusionFM](https://weibo.com/TechFusionFM) | Reclaim and update bio | ZH |
| Telegram channel | [t.me/TechFusionFM](https://t.me/TechFusionFM) | Update the description; post new-episode notifications here | ZH + EN |
| Telegram group | [t.me/TechFusionChat](https://t.me/TechFusionChat) | Check the admins; pin the FAQ link; remove the old bot if it's still a member (§0.1) | ZH |
| Bilibili | none yet (`social.bilibili` empty) | Reclaim or create. If you upload audio or video episodes, set `social.bilibili` to the numeric space id | ZH |
| WeChat 公众号 | none in the theme | Reclaim if it exists. Export the follow QR to `source/images/wechat-qr.png` and set `social.wechat_qr: images/wechat-qr.png` | ZH |
| 即刻 | none | Create or reclaim; a good fit for the mainland tech audience | ZH |
| Bluesky | none yet (`social.bluesky` empty) | Create `@techfusionfm.com`, verifying the domain handle with a DNS TXT record, and set `social.bluesky: techfusionfm.com` | EN + ZH |
| Threads | none | Create from the Instagram account (optional) | EN + ZH |
| 知乎专栏 | [zhuanlan.zhihu.com/TechFusion](https://zhuanlan.zhihu.com/TechFusion) | Reclaim, or retire it and remove the link from the FAQ and posts | ZH |

If you decide not to keep an account, retire it: post one final message pointing to the website, then remove the account from `social:` and the FAQ.

### Unified bio

Link in bio, everywhere: **https://TechFusionFM.com/faq/**. That page lists every feed, app and handle in one place.

- **中文（短）:**
  > 《科技聚变》TechFusion：一档谈论互联网一切的中文科技播客。我们回来了。订阅 → TechFusionFM.com/faq
- **中文（长）:**
  > 《科技聚变》（TechFusion）是一档中文科技播客，我们谈论有关互联网的一切；旗下还有《聚焦》和《小玩意儿》。在 Apple Podcasts、小宇宙、Spotify 或任意播客 App 搜索「科技聚变」即可订阅。
- **English (short):**
  > TechFusion 科技聚变: a Chinese-language podcast about the internet and the people who make it. We're back. Subscribe → TechFusionFM.com/faq
- **Email:** hi@TechFusionFM.com

---

## 5. Launch content

### 5.1 "We're back" episode (#46)

- [ ] Record and edit. Export MP3 (mono 64–96 kbps or stereo 128 kbps), with ID3 title and artwork.
- [ ] Run `npx hexo new post 46`. This creates `source/_posts/46.md`; keep the filename, because it becomes `/46/` and the `<guid>`.
- [ ] Fill in the front matter:
  - `title`: no `#46:` prefix
  - `subtitle`: one or two sentences, used as the feed description
  - `date`: the publish time
  - `tags: podcast`
  - `media: audio/46.mp3`
  - `length`: `stat -c %s source/audio/46.mp3`
  - `media_type: audio/mpeg`
  - `duration`: `HH:MM:SS`, from `ffprobe -v error -show_entries format=duration -sexagesimal`
- [ ] Copy `46.mp3` into `source/audio/`. If it's over 100 MB, upload it to `<docroot>/audio/` by hand and add it to `.gitignore`.
- [ ] Write the body:
  - intro paragraph
  - `#### 章节：` list with `HH:MM:SS 标题` lines
  - `#### 参考链接：`, keeping the donate / FAQ / email boilerplate from post 45
  - `#### 主播：`
- [ ] Run `npm run build && npm run check:feeds`, and preview with `npm run server`.
- [ ] Merge to `master`. The deploy run uploads `46.mp3`, using `--ignore-existing`.
- [ ] Check that `/46/` loads and that the new item is at the top of `podcast.xml`. In Apple Podcasts Connect, use *Refresh feed* if it's offered.

### 5.2 Launch-day posting matrix

T-0 is the publish day. Apple listing approval can take days, so start §2 at least a week before T-0.

| When | X / Bluesky / Threads | Weibo / 即刻 | Telegram channel + group | Instagram | WeChat 公众号 |
|---|---|---|---|---|---|
| T-7 | Teaser (EN+ZH) | Teaser (ZH) | Teaser; pin in group | Artwork + teaser | Optional teaser article |
| T-0 | Launch post with link; pin it | Launch post | Launch post; pin | Story + post | Launch article |
| T+1 | Thank-you + "where to subscribe" | Same | "Subscribe in any app" + FAQ | Story | — |
| T+7 | Highlight clip / quote | Same | Ask for topics for #47 | Clip | Roundup |

**T-7 teaser**
- ZH: 《科技聚变》要回来了。{日期}，第 46 期：{一句话亮点}。现在就可以订阅 → {链接}
- EN: TechFusion 科技聚变 is coming back. Episode 46 drops {date}: {one-line hook}. Subscribe now → {link}

**T-0 launch**
- ZH: 我们回来了！《科技聚变》#46：{标题}。{一句话亮点} 收听 → {链接}
- EN: We're back. TechFusion #46: {title}. {one-line hook} Listen → {link}

**T+1 where to subscribe**
- ZH: 谢谢大家的转发和留言！在 Apple Podcasts、小宇宙、Spotify 搜索「科技聚变」，或在任意播客 App 中添加 RSS：https://TechFusionFM.com/podcast.xml 全部订阅方式 → https://TechFusionFM.com/faq/
- EN: Thanks for all the shares! Search "科技聚变" in Apple Podcasts, Spotify or 小宇宙, or add https://TechFusionFM.com/podcast.xml to any podcast app. All options → https://TechFusionFM.com/faq/

**T+7 follow-up**
- ZH: 《科技聚变》#46 上线一周，{一句话亮点或金句}。下一期想听我们聊什么？留言告诉我们。{链接}
- EN: One week since #46: {highlight or quote}. What should we talk about next? Reply and tell us. {link}

`{链接}` / `{link}` is the episode page (`https://TechFusionFM.com/46/`). Directory links go in follow-ups, once they're live.

### 5.3 Per-episode post template (reusable)

```
ZH:
《科技聚变》#{期数}：{标题}
{一句话亮点}
🎧 {链接}
章节：{00:00 话题一} / {00:00 话题二} / {00:00 话题三}
#科技聚变 #播客

EN:
TechFusion #{number}: {title}
{one-line hook}
Listen → {link}
```

Use the same text for spotlight / gadgets episodes, with 《聚焦》 / 《小玩意儿》 and their category page links (`/categories/spotlight/`, `/categories/gadgets/`).

---

## 6. After launch

- **Phase 4 data.** The hosting decision in [docs/hosting.md](./hosting.md) is blocked on two owner inputs:
  - **Mainland HTTP and latency tests**, now meaningful with valid TLS. Use the tools listed in [verification/hosting-research.md](../verification/hosting-research.md): ITDOG, boce, Ping.pe and Comparitech. Test off-peak and at 20:00–23:00 Beijing time, and record the results in that file.
  - **Audience split** (mainland vs. diaspora), from the Apple Podcasts Connect, 小宇宙 and Spotify dashboards plus nginx access logs, once the listings have about 30–90 days of data.
- **TLS watch.** If a `TLS watch` failure email arrives, run `sudo certbot renew` and check the timer.
- **Enclosure-length audit.** Re-run the audio manifest whenever audio files change, using the steps in [verification/audio-manifest.md](../verification/audio-manifest.md#regenerating), so `<enclosure length>` keeps matching the real file sizes. For new episodes, `length` must equal `stat -c %s` of the MP3.
- **Directory links.** Fill in `shows.*.links.*` as listings are approved (§3), and keep the FAQ in sync.
