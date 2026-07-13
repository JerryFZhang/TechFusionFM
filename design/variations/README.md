# Phase 3 — design directions (pick one, or mix)

Five distinct visual directions for the 科技聚变 homepage. **None is chosen** — this is a gallery to react to. All five:

- are **Chinese-first** (the 科技聚变 wordmark leads; Latin is secondary),
- use the **real** episode catalog (eps 45–40, the three feeds, real dates/durations),
- ship **light + dark** themes (◐ toggle) and honor `prefers-reduced-motion`,
- are self-contained (open the `.html` directly in a browser — no build, no network),
- keep the reboot honest ("重启在即"), and touch **nothing** about the feed/build.

> Implementation note: whichever wins is built as a **restyle of the existing Anatole/Hexo 7 theme** — CSS + light template edits only. The feed generator, the GUID case-pin, and every URL stay untouched. See [`../../specs/phase-3-design.md`](../../specs/phase-3-design.md).

| # | Direction | The idea | Feel | File |
|---|---|---|---|---|
| A | **Reactor Core** | 聚变 = *fusion*; plasma against a cold void, animated particle-convergence core | Energetic, digital, dark-forward | [`reactor-core.html`](./reactor-core.html) |
| B | **广播 / Broadcast Console** | The show as live radio — ON AIR sign, VU meter, FM 88.6 dial, episodes as a 播出记录 | Warm, analog, tactile | [`broadcast.html`](./broadcast.html) |
| C | **活字 / Editorial + 印章** | A serious Chinese type-culture publication; a vermilion 印章 seal as the mark, vertical-text eyebrows | Quiet, authoritative, print | [`editorial.html`](./editorial.html) |
| D | **终端 / Terminal** | For the internet's builders — the site as a shell session; episodes as a `git log --feed` table; subscribe as commands | Precise, nerdy, refined | [`terminal.html`](./terminal.html) |
| E | **信号 / Waveform** | Audio-native — an oscilloscope waveform *is* the identity, sweeping through the wordmark; per-episode sparklines | Modern, kinetic, duotone | [`waveform.html`](./waveform.html) |

## How to view

Open any file in a browser, or serve the folder:

```sh
python3 -m http.server -d design/variations 8000
# then open http://localhost:8000/terminal.html etc.
```

Each was drafted by a dedicated design pass and run through an adversarial critique/repair pass (rendering bugs, contrast, theme-toggle correctness, cliché-drift, contract compliance).

## Choosing

You can pick one outright, or mix — e.g. Terminal's episode table with Editorial's restraint, or Reactor's energy with Waveform's audio-native player. Tell me the winner (or the mix) and I'll implement it on the theme and re-run feed parity.
