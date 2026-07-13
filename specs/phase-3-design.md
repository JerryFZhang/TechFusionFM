# Spec: Phase 3 — Design refresh (direction)

**Status:** Directions proposed, awaiting owner sign-off. Not yet implemented.
**Depends on:** Phase 2 (Hexo 7 + Pug theme). **Does not touch:** the feed generator, the GUID pin, or any URL.
**Gallery:** [`design/variations/`](../design/variations/) — **five** distinct directions to choose from ([README](../design/variations/README.md)). The reactor-core below is direction **A**; B–E (broadcast / editorial-seal / terminal / waveform) are alternates. Open any `.html` in a browser; ◐ toggles light/dark.

---

## 1. The idea

聚变 means *fusion* — nuclear fusion. The identity is built on that: a **reactor core**, hot plasma against a cold void. It gives the show a distinctive, subject-true look instead of a generic "modern podcast" template, and it reads as confidently Chinese-first (the 科技聚变 wordmark is the hero, Latin is secondary).

This is a **restyle, not a rewrite.** Same Hexo 7, same Anatole templates, same three feeds. Phase 3 changes CSS and light template markup only. The load-bearing feed serialization — `vendor/hexo-generator-multiple-podcast`, the permalink/GUID case-pin (`vendor/PATCHES.md §2`), the enclosure paths — is not touched. Design must never re-open the subscriber-safety invariant Phase 2 secured.

## 2. Design tokens

**Color** — reactor core:
| token | value | role |
|---|---|---|
| `--core` | `#FF3B5C` | plasma accent, primary |
| `--core-2` | `#FFB13C` | amber; *fuses* with core — used only in the hero mark |
| `--focus-hue` | `#FFB13C` | 《聚焦》channel marker |
| `--gadget-hue` | `#33E1CE` | 《小玩意儿》channel marker |
| ink/void (dark) | `#0A0C12` | cool blue-black ground — chosen cold against the hot accent |
| paper (light) | `#EDEFF5` | cool paper, slight blue bias |

Neutrals are deliberately cool-biased (toward the void), not a default grey. Both themes are first-class — see §4.

**Type** — three roles:
- **Display / body (Chinese):** system Han stack — `"PingFang SC","Hiragino Sans GB","Noto Sans SC","Microsoft YaHei"`. No webfont: the correct Chinese faces are already on-device, and a Chinese webfont would be multi-MB. Chinese-first means the Han type is the star.
- **Data / labels (Latin):** monospace (`ui-monospace,"SF Mono",…`) with `tabular-nums` — episode numbers, durations, dates, section labels. This is the "instrument readout" that carries the reactor metaphor into the details.

**Layout:** a sticky slim header; a full-bleed hero with an ambient canvas particle-convergence to a glowing core behind the wordmark (respects `prefers-reduced-motion`); a featured-episode card with a styled player; the three feeds as a **channel switcher** (科技聚变 / 聚焦 / 小玩意儿) that swaps the episode list and re-tints the accent; episode rows as instrument-panel readouts; a subscribe block.

## 3. Why the three-channel switcher matters

The legacy theme has three separate per-feed sidebars (`sidebar.pug`, `sidebar-spotlight.pug`, `sidebar-gadgets.pug`). The redesign turns that structural fact — three real feeds — into the primary navigation, each with its own hue, so the show's shape is legible at a glance. This is content-driven, not decoration.

## 4. Implementation plan (when approved)

1. Replace `themes/anatole/source/css/style.*` with the token-based stylesheet from the mockup (port to Stylus, the theme's renderer). Keep `blog_basic.css`/`font-awesome` or drop FA in favor of inline SVG.
2. Light template edits only: `layout.pug` (header + theme toggle), `index.pug` (hero + featured + channel list), `post.pug` (episode page + player), the three sidebars fold into the channel switcher.
3. Keep every feed route and the podcast generator untouched. After any theme change: `npx hexo generate` + re-run the feed parity check (GUIDs/enclosures byte-identical) before merge — a template edit must not alter feed output.
4. Both themes verified; `prefers-reduced-motion` honored; keyboard focus states; responsive down to mobile.

## 5. Non-goals

- No SSG change (Astro was considered and rejected in Phase 2 — `specs/phase-2-stack-modernization.md`).
- No feed/URL/GUID change. No new backend.
- Not a content rewrite — show notes stay as authored.

## 6. Open questions for the owner

- Sign off on the reactor-core direction, or request alternates?
- Keep the ambient canvas animation, or a static core glow only?
- Real cover art per episode (the mockup uses a generated placeholder), or keep the generative core motif?
