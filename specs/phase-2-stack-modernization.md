# Spec: Phase 2 — Stack Modernization

**Status:** Ready to execute
**Owner:** TBD
**Branch base:** `main` (Phase 1 already merged via `claude/techfusionfm-redesign-plan-XxGW1`)
**Estimated effort:** ~1 day of focused work + verification

---

## 1. Context

TechFusionFM is a Chinese-language tech podcast site built on Hexo. It publishes three RSS feeds (`podcast`, `spotlight`, `gadgets`), each with its own sidebar variant in the Anatole theme, served from `TechFusionFM.com`.

The repo is currently pinned to a 2019-era stack: Hexo 3.8, Jade templates, Stylus, and a bag of plugins whose maintenance has lapsed. `npm install` does not complete on Node ≥ 14, which blocks CI, blocks contributors, and blocks any forward work.

Phase 1 (housekeeping — typo fix, README, Snyk removal, archive cleanup) shipped in commit `5510072`. This spec covers Phase 2: get the site building cleanly on modern Node, with no observable change for listeners or the audience.

Design refresh is **Phase 3** and explicitly out of scope here.
Hosting / mainland-China delivery is **Phase 4** and out of scope.

## 2. Goal

The site builds on current-LTS Node, with a maintained dependency tree, producing RSS feeds and HTML that are byte-identical (modulo build-date stamps) to today's production output.

## 3. Non-goals

- No visual or design changes — CSS/JS/Stylus/images/fonts stay byte-identical.
- No content changes — no edits to posts in `source/_posts/`.
- No feed URL or GUID changes — subscribers must not lose history.
- No new features (comments, search, dark mode, etc.).
- No hosting migration.
- Not introducing a new SSG (Astro, Eleventy, etc.) — that option was considered and rejected in favor of staying on Hexo to minimize migration surface.

## 4. Current state (what you're starting from)

| Concern | Current |
|---|---|
| SSG | Hexo `3.8.0` (released 2019) |
| Templates | Jade via `hexo-renderer-jade@0.3.0` (Jade is EOL; renamed to Pug in 2016) |
| Styles | Stylus via `hexo-renderer-stylus@0.3.1` |
| Theme | Custom-customized fork of Anatole, with three sidebar variants per feed |
| Feed generator | `hexo-generator-multiple-podcast@0.9.3` — **vendored under `node_modules/` and committed to the repo** (likely patched) |
| Markdown | `hexo-renderer-marked@0.2.10` — **vendored under `node_modules/` and committed to the repo** (likely patched) |
| Index generator | `hexo-generator-index2@0.0.1` (the "2" fork is dead; mainline `hexo-generator-index` has caught up) |
| Minifier | `hexo-all-minifier@0.0.14` (unmaintained) |
| Admin | `hexo-admin@2.1.0` declared but unclear if used |
| Install on Node 20 | Fails |

Key files:
- `_config.yml` — site config, including the three `podcasts:` feed blocks and the `index_generator.include: - tag podcast` rule that keeps non-podcast tags off the home page
- `package.json` — declares Hexo 3.8 + plugins; also (incorrectly) declares `npm` itself as a dep
- `themes/anatole/layout/*.jade` — 8 top-level templates (`index`, `post`, `page`, `archive`, `category`, `tag`, `mixins`) + 1 layout
- `themes/anatole/layout/partial/*.jade` — 7 partials including three per-feed sidebars: `sidebar.jade`, `sidebar-spotlight.jade`, `sidebar-gadgets.jade`
- `themes/anatole/source/css/` and `source/js/` — leave alone
- `backup-rss.xml` — 240KB snapshot of the production podcast feed, useful as a parity baseline

## 5. Target state

| Concern | Target |
|---|---|
| Node | Current LTS (Node 22 LTS as of this spec; verify against `nodejs.org/en/about/previous-releases` at execution time) |
| SSG | Hexo `^7.x` |
| Templates | Pug via `hexo-renderer-pug` |
| Styles | Stylus (unchanged; renderer still maintained) |
| Theme | Same Anatole, templates renamed `.jade` → `.pug` and syntax-fixed; everything else byte-identical |
| Vendored plugins | Resolved (see §6.2) |
| Install on current LTS | `npm ci` clean, no warnings about deprecated direct deps |
| CI | GitHub Actions workflow that runs `hexo generate` on push/PR |

## 6. Work plan

### 6.1 Node baseline
- Add `engines.node` to `package.json` pinning supported range (e.g. `">=22 <23"`)
- Add `.nvmrc` with the matching version
- Remove `npm` from `dependencies` (it's a system tool, not a project dep)

### 6.2 Resolve vendored plugins
Before doing anything else, settle the vendored plugin question:

1. For each of `node_modules/hexo-renderer-marked/` and `node_modules/hexo-generator-multiple-podcast/`:
   - Diff against the upstream version at the pinned semver
   - If unmodified: drop from git, let `npm install` provide them
   - If patched: document the diff in `vendor/PATCHES.md`. Choose one of:
     - (a) Upstream the patch — best if accepted quickly
     - (b) Fork to `techfusionfm/<plugin>-fork`, publish under a scoped name, depend on the fork
     - (c) Keep vendored, but move to `vendor/<plugin>/` and reference via `file:` dep, so it's no longer pretending to be a normal `node_modules` entry

The likely patches involve XML formatting in the podcast generator (since feed parity is the hard constraint). Treat any divergence in `<enclosure>`, `<guid>`, or iTunes namespace tags as load-bearing.

### 6.3 Hexo core + plugin swaps
Update `package.json`:

| Old | New | Notes |
|---|---|---|
| `hexo ^3.7.1` | `hexo ^7.0.0` | |
| `hexo-renderer-jade` | `hexo-renderer-pug` | |
| `hexo-renderer-marked ^0.2.10` | `hexo-renderer-marked ^6.x` (or whatever current is) | Or vendored — see §6.2 |
| `hexo-renderer-stylus ^0.3.1` | `hexo-renderer-stylus ^3.x` | Verify Anatole's `.styl` files still parse |
| `hexo-renderer-ejs ^0.2.0` | `hexo-renderer-ejs ^2.x` | Confirm anything still uses EJS; if not, drop |
| `hexo-generator-index2 0.0.1` | `hexo-generator-index ^3.x` | Verify the `include: - tag podcast` filter behaves identically |
| `hexo-generator-archive ^0.1.4` | `hexo-generator-archive ^2.x` | |
| `hexo-generator-category ^0.1.3` | `hexo-generator-category ^2.x` | |
| `hexo-generator-tag ^0.2.0` | `hexo-generator-tag ^2.x` | |
| `hexo-generator-robotstxt ^0.2.0` | Latest maintained equivalent | |
| `hexo-generator-seo-friendly-sitemap 0.0.20` | `hexo-generator-sitemap` or maintained alt | Verify XML output shape |
| `hexo-all-minifier 0.0.14` | Drop, or replace with `hexo-minify` if size matters | Removing minification simplifies the byte-diff verification; recommend dropping for Phase 2 and revisiting in Phase 3 |
| `hexo-admin ^2.1.0` | Drop if unused (confirm with owner first) | |
| `hexo-footnotes ^1.0.1` | Latest | Confirm footnotes still render in posts that use them |
| `broken-link-checker ^0.7.8` | Drop from runtime deps; if wanted, move to a CI-only script | |
| `hexo-server ^0.2.0` | `hexo-server ^3.x` | |
| `npm ^6.13.4` | **Remove** | |

If `hexo-all-minifier` is dropped, also update `_config.yml` to remove or disable the `html_minifier`, `css_minifier`, `js_minifier`, `image_minifier` blocks.

### 6.4 Jade → Pug port
Pug is the renamed successor of Jade; syntax is ~95% compatible. The port is mostly mechanical.

1. Rename every `themes/anatole/layout/**/*.jade` to `*.pug` (13 files)
2. Fix the known Pug-vs-Jade syntax breaks; grep for and address:
   - **Attribute interpolation:** `a(href="#{post.url}")` → `a(href=post.url)`. Pug rejected the string-interpolation form.
   - **Inline interpolation tags:** `#[strong text]` syntax is fine; just confirm none use the older `!{}` unescaped form unintentionally.
   - **`each ... else`:** the `else` clause must be on its own line, not chained.
   - **Quoted attributes:** Pug is stricter about quote balancing inside attributes.
   - **Doctype:** ensure each top-level template has `doctype html` (or inherits via `extends`).
3. Re-run `hexo generate` and fix any compile errors surfaced.

Do not touch `themes/anatole/source/` (CSS, JS, images, fonts).

### 6.5 CI
Add `.github/workflows/build.yml`:
- Triggers: `push` to any branch, `pull_request` to `main`
- Steps: checkout, setup-node (read version from `.nvmrc`), `npm ci`, `npx hexo generate`
- Cache `node_modules` keyed on `package-lock.json`
- Fail on non-zero exit

No deploy step in this phase — deploy is Phase 4.

## 7. Verification

Parity matters more than anything else here. A clean build that drops an item from the podcast feed has failed the spec.

### 7.1 Baseline capture
Before any changes, capture the current production output as the source of truth:

1. Pull the live RSS feeds: `curl https://TechFusionFM.com/podcast.xml`, `spotlight.xml`, `gadgets.xml` → save to `verification/baseline/`
2. Pull 5 representative post pages (newest, oldest, one from each of the three categories) → save HTML to `verification/baseline/`
3. Save the home page

(Skip trying to reproduce the build on legacy Node — production output is the canonical baseline.)

### 7.2 Post-port comparison
After the migration:

1. `npx hexo generate`
2. Diff `public/podcast.xml`, `public/spotlight.xml`, `public/gadgets.xml` against `verification/baseline/`
   - **Allowed diffs:** `<lastBuildDate>`, `<pubDate>` for the channel itself, whitespace differences between elements
   - **Forbidden diffs:** any `<item>` add/remove, any `<guid>` change, any `<enclosure url=>` change, iTunes tag changes
3. Diff sampled post HTML
   - **Allowed:** whitespace, minifier choices (if minifier was removed), DOCTYPE casing
   - **Forbidden:** missing content, broken links, missing `<audio>` tags, missing show-notes formatting

### 7.3 Manual checks
- Home page renders, three sidebars correct for each feed context
- Audio player works on one post per feed
- Pagination (if any) works
- 404 page renders

## 8. Acceptance criteria

- [ ] `npm ci` succeeds on current Node LTS with no warnings for direct deps
- [ ] `npx hexo generate` exits 0 with no Pug compile errors
- [ ] All three feed XML files diff-clean vs. baseline (per §7.2 rules)
- [ ] Item count + GUIDs unchanged across all three feeds
- [ ] 5 sampled post pages render visually identically
- [ ] Three sidebar variants (`sidebar`, `sidebar-spotlight`, `sidebar-gadgets`) render correctly
- [ ] GitHub Actions workflow builds the site green
- [ ] Vendored plugin question resolved (§6.2) with a clear paper trail
- [ ] `PLAN.md` Phase 2 section updated to reflect what shipped
- [ ] PR description includes the verification diff summary

## 9. Open questions (resolve before/during execution)

1. **Are the vendored plugins actually patched, and how?** Diff against upstream first thing — answers shape §6.2.
2. **Is `hexo-admin` still in use?** Owner confirms — drop if not.
3. **Is `hexo-renderer-ejs` still needed?** Grep theme + source for `.ejs` files. If none, drop.
4. **Does anything use `hexo-footnotes`?** Grep `source/_posts/` for footnote markdown syntax.
5. **What's the precise current Node LTS at execution time?** Pin to that.
6. **Does anything in the build output get rewritten by `hexo-all-minifier` in a way that matters for SEO or feed validity?** If yes, replace; if no, drop.

## 10. Risks

- **Vendored plugin patches are load-bearing for feed format.** Diff carefully; if you swap to upstream without porting the patch, subscriber GUIDs may shift and feed history breaks.
- **Stylus renderer upgrade may reject older syntax.** Likelihood low (Stylus is stable), but if Anatole uses deprecated `@import` patterns or block-comment styles, expect to clean those up.
- **Pug strict mode catches valid-Jade attribute strings.** Plan for one round of compile-error iteration beyond the known break list.
- **Removing the minifier changes byte output.** If kept, find a maintained alternative; if dropped, recapture baseline post-port with minification off so comparison is meaningful.
- **`hexo-generator-index2` vs. mainline `hexo-generator-index`.** The "2" fork existed for a reason; confirm the home-page tag filter still works after the swap.

## 11. Deliverable

One PR against `main`:
- Updated `package.json`, `package-lock.json`, `.nvmrc`
- Renamed + syntax-fixed `themes/anatole/layout/**/*.pug` files
- Deleted `themes/anatole/layout/**/*.jade` files
- Possibly cleaned-up `_config.yml` (minifier blocks)
- `.github/workflows/build.yml`
- `vendor/PATCHES.md` if any plugin was kept vendored
- `verification/baseline/` files committed for reproducibility (or deleted post-merge — owner's call)
- `PLAN.md` updated
- PR description summarizing: what was upgraded, what was dropped, the verification diff result, and any followups bumped to Phase 3/4

## 12. Followups (do not do in this PR)

- Anatole visual refresh: CSS variables, dark mode, responsive cleanup (Phase 3)
- Hosting decision: mainland-China-friendly delivery without ICP filing (Phase 4)
- Comment system / search / analytics
- Auto-deploy on merge
- Asset pipeline modernization (image resizing, modern formats)
