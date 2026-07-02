# Vendored plugin patch audit

This document records the divergence between the two Hexo plugins committed under
`node_modules/` in this repository and their upstream npm releases at the same
version. It exists to inform the §6.2 decision in
[`specs/phase-2-stack-modernization.md`](../specs/phase-2-stack-modernization.md):
before swapping Hexo 3 → Hexo 7 we must know which (if any) local edits are
load-bearing for RSS feed parity, so that feed subscribers do not lose history
or break clients.

Audit method:

1. Read pinned version from each vendored `package.json`.
2. Fetch matching upstream tarball from the npm registry
   (`https://registry.npmjs.org/<pkg>/-/<pkg>-<version>.tgz`).
3. `diff -ruN upstream/ vendored/ --exclude=node_modules --exclude=package.json`.
   `package.json` is excluded because npm rewrites it on install (`_from`,
   `_resolved`, `_where`, etc.) — those edits are noise, not patches.
4. Focus on `.js` and template (`.xml`) files; ignore READMEs, lint config,
   licenses.

---

## 1. `hexo-renderer-marked`

- **Vendored version (per `node_modules/hexo-renderer-marked/package.json`):**
  `0.2.11` (declared `^0.2.10` in `package.json`).
- **Upstream tarball:**
  <https://registry.npmjs.org/hexo-renderer-marked/-/hexo-renderer-marked-0.2.11.tgz>
- **Upstream repo:** <https://github.com/hexojs/hexo-renderer-marked>

### Diff summary

Exactly **one** file differs: `lib/renderer.js`. One hunk, one line.

```diff
--- upstream/lib/renderer.js
+++ vendored/lib/renderer.js
@@ -29,7 +29,7 @@
     headingId[id] = 1;
   }
   // add headerlink
-  return '<h' + level + ' id="' + id + '"><a href="#' + id + '" class="headerlink" title="' + stripHTML(text) + '"></a>' + text + '</h' + level + '>';
+  return '<h' + level + '>' + text + '</h' + level + '>';
 };
```

### What it does

Upstream emits each heading with an anchor id and an inline `<a class="headerlink">`
back-reference (Hexo's default "click to copy heading URL" behavior). The vendor
patch strips that, emitting a bare `<hN>text</hN>`.

### Is this load-bearing for the RSS feed?

**No, for the feed format itself.** The podcast generator's `<description>`
field uses `episode.subtitle` (see vendored `rss2.xml` diff in §2 below) — it
does not embed rendered HTML body. The `<content:encoded>` block is conditional
on `feedConfig.content_encoded`, and the renderer only affects what HTML appears
inside that CDATA — it would not change `<guid>`, `<enclosure>`, `<pubDate>`, or
any iTunes namespace tag.

**It is load-bearing for HTML output** (post pages will gain `id="…"` anchors
and `<a class="headerlink">` markup if we drop to upstream). That is a Phase 2
HTML parity concern, not a feed concern; the spec explicitly allows whitespace
and minor markup diffs in sampled post HTML, but adding extra anchor elements
inside every heading element (h1 through h6) is a structural change that would
show up across the whole site.

### Recommendation: **(b) move to `vendor/hexo-renderer-marked/` and depend via `file:`**

Rationale:

- The patch is trivial (one line) and stable since 2016, but it changes HTML
  shape across every post. Carrying it explicitly keeps post-page parity in
  Phase 2 without a separate "fix the headerlink markup" subtask.
- Modern Hexo's current `hexo-renderer-marked@^6` exposes a
  `headerIds`/`prependRoot` config that can disable the anchor — so the
  long-term path is to drop the vendor entirely and configure the modern
  renderer instead. That's a Phase 3 task once visual parity is verified.
- A `file:` dep makes the local-ness explicit (today it is masquerading as a
  registry install, which is what made this audit necessary in the first
  place).
- Option (a) "upstream the patch" is not viable: upstream's behavior — emitting
  anchors — is intentional and matches every other Hexo renderer. They would
  not accept "remove anchors" as a default.
- Option (c) "fork + publish under a scoped name" is overkill for a one-line
  diff that we plan to delete in Phase 3 anyway.

---

## 2. `hexo-generator-multiple-podcast`

- **Vendored version (per `node_modules/hexo-generator-multiple-podcast/package.json`):**
  `0.9.3`.
- **Upstream tarball:**
  <https://registry.npmjs.org/hexo-generator-multiple-podcast/-/hexo-generator-multiple-podcast-0.9.3.tgz>
- **Upstream repo:**
  <https://github.com/danieljsummers/hexo-generator-multiple-podcast>

### Diff summary

Two files differ: `lib/generator.js` and `rss2.xml`.

#### `rss2.xml` — load-bearing feed format changes

```diff
@@ channel header @@
-    <language>{{ feedConfig.language }}</language>
+    <language>zh</language>
```

Hardcodes the feed language to `zh`. Upstream reads from per-feed config.
Subscribers and aggregators key on `<language>` for locale handling.

```diff
@@ per-item @@
-      <description>{{ episode.content | striptags }}</description>
+      <description>{{ episode.subtitle }}</description>
```

**This is the headline change.** Upstream populates `<description>` with the
stripped-HTML post body. The vendored version emits the post's `subtitle`
front-matter field instead. Every existing item in the production feed has
`<description>` = subtitle. If we drop to upstream, every item's
`<description>` will change to the full post body — clients that surface
descriptions in the episode list (Apple Podcasts, Overcast, Pocket Casts) will
flip from one-line summary to multi-paragraph dump on the very next feed fetch.
**This is exactly the feed-format risk §6.2 warns about.**

#### `lib/generator.js` — mostly formatting + one semantic change

Most of the diff is whitespace/style reformatting (CRLF-ish line-ending of
trailing whitespace, multi-line method chaining, brace spacing). Those are
cosmetic.

The semantic changes:

1. **Episode numbering injected into title:**
   ```diff
   +    var episode = podcast_posts.length + 1;
   ...
   +        episode--
            return {
   -          title: post.title,
   +          title: "#" + episode + ": " + post.title,
   ```
   Every `<item><title>` is prefixed with `#N: ` (descending, so the newest
   post gets the highest number). Production feed item titles use this format
   today — dropping the patch would strip `#N: ` from every title.

2. **`content` field removed from episode payload:**
   ```diff
   -        content,
            content_encoded,
   ```
   The vendor passes only `content_encoded` to the template. This is paired
   with the `rss2.xml` `<description>` change — upstream's `episode.content`
   path is unused.

### Is this load-bearing for the RSS feed?

**Yes, decisively.** Three observable feed-format consequences if we drop to
upstream:

- `<language>` flips from `zh` to whatever `feedConfig.language` resolves to
  (likely undefined → empty element).
- `<description>` flips from one-line subtitle to full post body.
- `<title>` loses the `#N: ` episode-number prefix.

None of these change `<guid>` or `<enclosure url>`, so subscriber identity is
preserved — but episode list rendering in every podcast client would shift
visibly, which violates §3 ("no observable change for listeners").

#### `lib/generator.js` — Phase 2 addition: permalink/GUID case pin

Added during the Hexo 3 → 7 migration (not part of the original 2019 patch
set). Hexo ≥ 5 computes `post.permalink` via `full_url_for`, which runs the
URL through the WHATWG `URL` parser and therefore lowercases the host:
`https://TechFusionFM.com/45/` became `https://techfusionfm.com/45/`. The
feed template uses `episode.permalink` for both `<link>` and `<guid>`, and
RSS `<guid>`s are opaque case-sensitive strings — every published episode
would have re-appeared as new in podcast clients. The patch rebuilds the
permalink the way Hexo 3 did:

```diff
-          permalink: post.permalink,
+          permalink: config.url + config.root + post.path,
```

Verified byte-identical `<guid>` and `<link>` values against
`backup-rss.xml` (the production feed snapshot).

### Recommendation: **(b) move to `vendor/hexo-generator-multiple-podcast/` and depend via `file:`**

Rationale:

- The patch is small but the behavior is product-shaped (episode numbering, the
  subtitle-as-description convention) — not a generic improvement. Upstreaming
  it (option a) would not be accepted: it is a TechFusionFM editorial choice,
  not a bug fix.
- Option (c) "fork + publish under a scoped name" is the textbook-correct
  answer, but it adds an npm-publish + maintenance obligation for a plugin
  that last shipped in 2017 and that we should eventually replace with a
  modern alternative (`hexo-generator-feed` with a podcast template, or
  `hexo-generator-podcast`). A `file:` dep parks the patches visibly inside
  the repo with zero external surface, and the eventual replacement work
  becomes a clean Phase 3+ task.
- This plugin is the higher-risk of the two; making its local-ness loud and
  obvious (in `vendor/` rather than buried in `node_modules/`) is itself part
  of the value.

---

## Summary table

| Plugin | Patched? | Feed-format impact | Recommendation |
|---|---|---|---|
| `hexo-renderer-marked@0.2.11` | Yes (1 line, headerlink markup stripped) | No (HTML body only; feed uses `subtitle`) | (b) `vendor/` + `file:` dep |
| `hexo-generator-multiple-podcast@0.9.3` | Yes (language, description, title `#N:`) | **Yes** — all three would flip on every item | (b) `vendor/` + `file:` dep |

## Followup (Phase 3+)

- Migrate `hexo-renderer-marked` patch to the modern renderer's
  `headerIds: false` (or equivalent) config, then drop the vendor copy.
- Evaluate replacing `hexo-generator-multiple-podcast` with a maintained
  feed generator; port the three behaviors (locale, description=subtitle,
  title prefix) into the new generator's templating.
